import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ChevronDown, Maximize2 } from "lucide-react";
import { connectSignalingSocket, disconnectSignalingSocket, sendSignal, subscribeSignal } from "../callSocket.js";
import { useLang } from "../i18n.jsx";
import Avatar from "./Avatar.jsx";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function fmtDuration(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/**
 * Persistent, app-wide live call layer. Mounted once in App.jsx so an
 * incoming call can ring no matter which page is open. Signaling travels
 * over a WebSocket to /api/staff-chat/ws/call; audio flows directly between
 * browsers via WebRTC (one peer connection per participant - a "group call"
 * is really admin holding several simultaneous 1-on-1 connections at once,
 * mixed together locally, with admin as the hub).
 *
 * Staff can only ever call/be called by admin. Parent triggers calls
 * imperatively:
 *   ref.current.startCall(toUsername, displayName)
 *   ref.current.startGroupCall([usernames...], groupLabel)   // admin only
 */
const CallOverlay = forwardRef(function CallOverlay({ username }, ref) {
  const { t } = useLang();

  const pcMapRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const audioElsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const timerRef = useRef(null);
  const handleSignalRef = useRef(() => {});
  const audioContainerRef = useRef(null);

  const [groupLabel, setGroupLabel] = useState(null);
  const [participants, setParticipants] = useState({});
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState("");
  const [minimized, setMinimized] = useState(false);

  const anyActive = Object.keys(participants).length > 0;
  const allConnected = anyActive && Object.values(participants).every((p) => p.status === "connected");
  const isRinging = Object.values(participants).some((p) => p.status === "ringing");
  const overallStatus = isRinging ? "ringing" : allConnected ? "connected" : anyActive ? "calling" : "idle";

  const send = useCallback((msg, toUsername) => {
    sendSignal({ ...msg, to_username: toUsername });
  }, []);

  const flashNotice = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice((cur) => (cur === text ? "" : cur)), 3500);
  }, []);

  const removeParticipant = useCallback((who) => {
    const pc = pcMapRef.current.get(who);
    if (pc) { try { pc.close(); } catch { /* already closed */ } }
    pcMapRef.current.delete(who);
    pendingCandidatesRef.current.delete(who);
    const audioEl = audioElsRef.current.get(who);
    if (audioEl) { audioEl.srcObject = null; audioEl.remove(); }
    audioElsRef.current.delete(who);
    setParticipants((prev) => {
      const next = { ...prev };
      delete next[who];
      return next;
    });
  }, []);

  const cleanupAll = useCallback(() => {
    for (const who of pcMapRef.current.keys()) removeParticipant(who);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    clearInterval(timerRef.current);
    timerRef.current = null;
    setDuration(0);
    setMuted(false);
    setGroupLabel(null);
    setParticipants({});
    setMinimized(false);
  }, [removeParticipant]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const mediaErrorLabel = useCallback((err) => {
    const name = err?.name || "Error";
    if (name === "NotFoundError" || name === "OverconstrainedError") return `${t("micError")} — no microphone found`;
    if (name === "NotAllowedError" || name === "SecurityError") return `${t("micError")} — permission blocked`;
    if (name === "NotReadableError") return `${t("micError")} — mic in use by another app`;
    return `${t("micError")} (${name})`;
  }, [t]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const attachRemoteAudio = useCallback((who, stream) => {
    let audioEl = audioElsRef.current.get(who);
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.muted = !speakerOn;
      if (audioContainerRef.current) audioContainerRef.current.appendChild(audioEl);
      audioElsRef.current.set(who, audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
  }, [speakerOn]);

  const createPeerConnectionFor = useCallback((who) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice-candidate", candidate: e.candidate }, who);
    };
    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (stream) attachRemoteAudio(who, stream);
    };
    pcMapRef.current.set(who, pc);
    pendingCandidatesRef.current.set(who, []);
    return pc;
  }, [send, attachRemoteAudio]);

  const startOneCall = useCallback(async (toUsername, displayName) => {
    const stream = await ensureLocalStream();
    const pc = createPeerConnectionFor(toUsername);
    stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setParticipants((prev) => ({ ...prev, [toUsername]: { status: "calling", name: displayName } }));
    send({ type: "offer", sdp: offer }, toUsername);
  }, [ensureLocalStream, createPeerConnectionFor, send]);

  const startCall = useCallback(async (toUsername, displayName) => {
    if (!toUsername || anyActive) return;
    try {
      await startOneCall(toUsername, displayName);
    } catch (e) {
      flashNotice(mediaErrorLabel(e));
      cleanupAll();
    }
  }, [anyActive, startOneCall, flashNotice, mediaErrorLabel, cleanupAll]);

  const startGroupCall = useCallback(async (usernames, label) => {
    const targets = (usernames || []).filter(Boolean);
    if (targets.length === 0 || anyActive) return;
    try {
      setGroupLabel(label || t("groupCall"));
      for (const u of targets) {
        await startOneCall(u, u);
      }
    } catch (e) {
      flashNotice(mediaErrorLabel(e));
      cleanupAll();
    }
  }, [anyActive, startOneCall, flashNotice, mediaErrorLabel, cleanupAll, t]);

  const acceptCall = useCallback(async (who) => {
    const entry = participants[who];
    if (!entry || !entry.offerSdp) return;
    try {
      const stream = await ensureLocalStream();
      const pc = createPeerConnectionFor(who);
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(entry.offerSdp));
      const queued = pendingCandidatesRef.current.get(who) || [];
      for (const cand of queued) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* stale */ }
      }
      pendingCandidatesRef.current.set(who, []);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", sdp: answer }, who);
      setParticipants((prev) => ({ ...prev, [who]: { ...prev[who], status: "connected" } }));
      startTimer();
    } catch (e) {
      flashNotice(mediaErrorLabel(e));
      send({ type: "call-declined" }, who);
      removeParticipant(who);
    }
  }, [participants, ensureLocalStream, createPeerConnectionFor, send, startTimer, flashNotice, mediaErrorLabel, removeParticipant]);

  const declineCall = useCallback((who) => {
    send({ type: "call-declined" }, who);
    removeParticipant(who);
  }, [send, removeParticipant]);

  const endAllCalls = useCallback(() => {
    for (const who of Object.keys(participants)) {
      const st = participants[who]?.status;
      send({ type: st === "calling" ? "call-cancelled" : "call-end" }, who);
    }
    cleanupAll();
  }, [participants, send, cleanupAll]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((tr) => { tr.enabled = muted; });
    setMuted((m) => !m);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      const next = !on;
      for (const audioEl of audioElsRef.current.values()) audioEl.muted = !next;
      return next;
    });
  }, []);

  const handleSignal = useCallback(async (data) => {
    const who = data.from_name;
    switch (data.type) {
      case "offer": {
        let busy = false;
        setParticipants((prev) => {
          if (Object.keys(prev).length > 0) { busy = true; return prev; }
          return { ...prev, [who]: { status: "ringing", name: who, offerSdp: data.sdp } };
        });
        if (busy) send({ type: "call-declined", reason: "busy" }, who);
        break;
      }
      case "answer": {
        const pc = pcMapRef.current.get(who);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const queued = pendingCandidatesRef.current.get(who) || [];
          for (const cand of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* stale */ }
          }
          pendingCandidatesRef.current.set(who, []);
          setParticipants((prev) => ({ ...prev, [who]: { ...prev[who], status: "connected" } }));
          startTimer();
        }
        break;
      }
      case "ice-candidate": {
        const pc = pcMapRef.current.get(who);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* stale */ }
        } else {
          const q = pendingCandidatesRef.current.get(who) || [];
          q.push(data.candidate);
          pendingCandidatesRef.current.set(who, q);
        }
        break;
      }
      case "call-declined":
        flashNotice(data.reason === "busy" ? t("callBusy") : t("callDeclined"));
        removeParticipant(who);
        break;
      case "call-cancelled":
      case "call-end":
        flashNotice(t("callEnded"));
        removeParticipant(who);
        break;
      case "unavailable":
        flashNotice(t("callUnavailable"));
        removeParticipant(who);
        break;
      case "call-taken":
        removeParticipant(who);
        break;
      default:
        break;
    }
  }, [send, startTimer, flashNotice, removeParticipant, t]);

  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  useEffect(() => {
    connectSignalingSocket(username);
    const unsubscribe = subscribeSignal((data) => handleSignalRef.current(data));
    return () => {
      unsubscribe();
      disconnectSignalingSocket();
    };
  }, [username]);

  useEffect(() => () => cleanupAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (overallStatus !== "ringing") return undefined;
    let stopped = false;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return undefined;
    const ctx = new Ctx();
    const beep = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    };
    beep();
    const id = setInterval(beep, 1500);
    return () => { stopped = true; clearInterval(id); ctx.close(); };
  }, [overallStatus]);

  useImperativeHandle(ref, () => ({ startCall, startGroupCall }), [startCall, startGroupCall]);

  const ringingEntry = Object.entries(participants).find(([, p]) => p.status === "ringing");
  const displayName = groupLabel || Object.values(participants)[0]?.name || "";
  const connectedCount = Object.values(participants).filter((p) => p.status === "connected").length;

  return (
    <div>
      <div ref={audioContainerRef} style={{ display: "none" }} />

      {notice && overallStatus === "idle" && (
        <div className="call-toast-notice">{notice}</div>
      )}

      {/* Incoming call: a small popup up top first - not full-screen until
          it's actually picked up, same as how a phone shows a ringing
          notification rather than jumping straight to the in-call screen. */}
      {ringingEntry && (
        <div className="call-incoming-popup">
          <Avatar name={ringingEntry[1].name} size="sm" />
          <div className="call-incoming-popup-text">
            <div className="call-incoming-popup-name">{ringingEntry[1].name}</div>
            <div className="call-incoming-popup-sub">{t("incomingVoiceCall")}</div>
          </div>
          <button className="call-popup-btn decline" onClick={() => declineCall(ringingEntry[0])} title={t("decline")}>
            <PhoneOff size={16} />
          </button>
          <button className="call-popup-btn accept" onClick={() => acceptCall(ringingEntry[0])} title={t("accept")}>
            <Phone size={16} />
          </button>
        </div>
      )}

      {/* Once picked up (or once an outgoing call starts ringing the other
          side), it's a real call in progress - that's when it earns the
          full-screen treatment, unless minimized down to the small pill. */}
      {anyActive && !ringingEntry && !minimized && (
        <div className="call-fullscreen">
          <button className="call-minimize-btn" onClick={() => setMinimized(true)} title={t("minimize")}>
            <ChevronDown size={20} />
          </button>
          <div className="call-fullscreen-inner">
            <div className="call-status-label">
              {overallStatus === "calling" ? `${t("calling")}…` : fmtDuration(duration)}
            </div>
            <div className={`call-avatar-ring ${overallStatus === "calling" ? "ringing" : "connected"}`}>
              <Avatar name={displayName} size="lg" />
            </div>
            <div className="call-name-text">
              {displayName}
              {groupLabel && <span className="call-group-count"> ({connectedCount}/{Object.keys(participants).length})</span>}
            </div>
            <div className="call-sub-text">
              {overallStatus === "calling" ? t("calling") : t("connected")}
            </div>
          </div>
          <div className="call-controls-row">
            <button className={`call-icon-btn ${muted ? "off" : ""}`} onClick={toggleMute} title={muted ? t("unmute") : t("mute")}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button className="call-icon-btn call-icon-btn-end" onClick={endAllCalls} title={t("endCall")}>
              <PhoneOff size={26} />
            </button>
            <button className={`call-icon-btn ${!speakerOn ? "off" : ""}`} onClick={toggleSpeaker} title={speakerOn ? t("speakerOff") : t("speakerOn")}>
              {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
          </div>
        </div>
      )}

      {/* Minimized: a small floating pill so the call keeps running in the
          background while the person goes back to using the app - tap it
          to bring the full call screen back. */}
      {anyActive && !ringingEntry && minimized && (
        <button className="call-minimized-pill" onClick={() => setMinimized(false)}>
          <Avatar name={displayName} size="sm" />
          <div className="call-minimized-pill-text">
            <div className="call-minimized-pill-name">{displayName}</div>
            <div className="call-minimized-pill-sub">
              {overallStatus === "calling" ? `${t("calling")}…` : fmtDuration(duration)}
            </div>
          </div>
          <Maximize2 size={14} className="call-minimized-expand-icon" />
          <span
            className="call-minimized-end-btn"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); endAllCalls(); }}
            title={t("endCall")}
          >
            <PhoneOff size={15} />
          </span>
        </button>
      )}
    </div>
  );
});

export default CallOverlay;
