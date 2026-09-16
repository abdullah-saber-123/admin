import { useEffect, useState, useRef, useCallback } from "react";
import { MessageSquare, Phone, Send, Users, Paperclip, Smile, Pencil, Trash2, X, Check, CheckCheck, FileText, Mic } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import Avatar from "./Avatar.jsx";
import { sendSignal, subscribeSignal } from "../callSocket.js";

const EMOJIS = ["😀", "😂", "👍", "🙏", "❤️", "😢", "😮", "👌", "🔥", "🎉", "✅", "❌", "⏰", "📞", "💰"];

function AttachmentPreview({ name, type, data }) {
  if (!data) return null;
  const isImage = (type || "").startsWith("image/");
  const isAudio = (type || "").startsWith("audio/");
  const src = `data:${type};base64,${data}`;
  if (isImage) {
    return <img src={src} alt={name} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, display: "block", marginTop: 4 }} />;
  }
  if (isAudio) {
    return <audio controls src={src} style={{ marginTop: 4, height: 34, maxWidth: 220 }} />;
  }
  return (
    <a href={src} download={name} className="chat-attachment-file">
      <FileText size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
      {name}
    </a>
  );
}

function ReadReceipt({ read }) {
  return read
    ? <CheckCheck size={13} style={{ verticalAlign: -2 }} className="chat-receipt-read" />
    : <Check size={13} style={{ verticalAlign: -2 }} className="chat-receipt-sent" />;
}

function ChatThread({ username, myUsername, phone, onCall, compact = false, online = false }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // { name, type, data }
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const windowRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const otherTypingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  // `username` is always "the other person in this DM" now - every
  // conversation is between two specific people, so the typing signal just
  // goes straight to them.
  const wsTarget = username;

  const load = useCallback(() => {
    api.getDmThread(username).then((data) => setMessages(data.messages)).catch(() => {});
  }, [username]);

  useEffect(() => {
    setMessages(null);
    load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for the other side's "typing" signal, and for a "new_message" push
  // so an open conversation updates instantly instead of waiting for the
  // next 6-second poll.
  useEffect(() => {
    const unsubscribe = subscribeSignal((data) => {
      if (data.from_name === myUsername) return; // ignore our own broadcast echo
      if (data.type === "typing") {
        setOtherTyping(true);
        clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
      } else if (data.type === "new_message" && data.from_name === username) {
        load();
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(otherTypingTimeoutRef.current);
    };
  }, [myUsername, username, load]);

  useEffect(() => () => clearInterval(recordTimerRef.current), []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    clearTimeout(typingTimeoutRef.current);
    sendSignal({ type: "typing", to_username: wsTarget });
    typingTimeoutRef.current = setTimeout(() => {}, 2000);
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      showToast(t("fileTooLarge"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setPendingFile({ name: file.name, type: file.type || "application/octet-stream", data: base64 });
    };
    reader.readAsDataURL(file);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    try {
      await api.sendDmMessage(username, {
        message: text.trim() || null,
        attachment_name: pendingFile?.name,
        attachment_type: pendingFile?.type,
        attachment_data: pendingFile?.data,
      });
      setText("");
      setPendingFile(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        clearInterval(recordTimerRef.current);
        setRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size === 0) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(",")[1];
          setSending(true);
          try {
            await api.sendDmMessage(username, {
              attachment_name: `voice-note.${mimeType === "audio/webm" ? "webm" : "m4a"}`,
              attachment_type: mimeType,
              attachment_data: base64,
            });
            load();
          } catch (err) {
            showToast(err.message, "error");
          } finally {
            setSending(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      showToast(t("micError"), "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      recordedChunksRef.current = [];
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach((tr) => tr.stop());
      };
      if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    }
    clearInterval(recordTimerRef.current);
    setRecording(false);
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.message || "");
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    try {
      await api.editDmMessage(username, id, editText.trim());
      setEditingId(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const deleteMessage = async (id) => {
    try {
      await api.deleteDmMessage(username, id);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", height: "100%", ...(compact ? { padding: 10, border: "none", boxShadow: "none" } : {}) }}>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="avatar-wrap">
              <Avatar name={username} size="sm" />
              {online && <span className="avatar-online-dot" />}
            </div>
            <strong style={{ fontSize: 13.5 }}>{username}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {phone && (
              <a className="icon-btn call-icon-btn" href={`tel:${phone}`} title={t("call")}>
                <Phone size={16} />
              </a>
            )}
            <button className="icon-btn call-icon-btn primary" onClick={onCall} title={t("callInApp")}>
              <Phone size={16} />
            </button>
          </div>
        </div>
      )}

      <div ref={windowRef} className="chat-window" style={{ flex: 1, minHeight: compact ? 160 : 300, maxHeight: compact ? "none" : 420 }}>
        {!messages && <div className="loading-state">{t("loadingDots")}</div>}
        {messages && messages.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
        {messages && messages.map((m) => {
          const mine = m.sender_username === myUsername;
          return (
            <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
              <div className="chat-bubble-sender">{m.sender_role === "admin" ? t("adminLabel") : m.sender_username}</div>
              {m.deleted ? (
                <div className="chat-bubble-text chat-deleted">{t("messageDeleted")}</div>
              ) : editingId === m.id ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <button className="icon-btn" onClick={() => saveEdit(m.id)} title={t("save")}><Check size={13} /></button>
                  <button className="icon-btn" onClick={() => setEditingId(null)} title={t("cancel")}><X size={13} /></button>
                </div>
              ) : (
                <>
                  {m.message && <div className="chat-bubble-text">{m.message}</div>}
                  <AttachmentPreview name={m.attachment_name} type={m.attachment_type} data={m.attachment_data} />
                </>
              )}
              <div className="chat-bubble-time">
                {fmtDateTime(m.created_at)}
                {m.edited_at && !m.deleted && ` · ${t("edited")}`}
                {mine && !m.deleted && (
                  <ReadReceipt read={m.read} />
                )}
              </div>
              {mine && !m.deleted && editingId !== m.id && (
                <div className="chat-bubble-actions">
                  {m.message && !m.attachment_name && (
                    <button className="icon-btn xs" onClick={() => startEdit(m)} title={t("edit")}><Pencil size={11} /></button>
                  )}
                  <button className="icon-btn xs" onClick={() => deleteMessage(m.id)} title={t("delete")}><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          );
        })}
        {otherTyping && <div className="chat-typing-indicator">{t("typingIndicator")}</div>}
      </div>

      {pendingFile && (
        <div className="chat-pending-attachment">
          <FileText size={13} />
          <span>{pendingFile.name}</span>
          <button className="icon-btn xs" onClick={() => setPendingFile(null)}><X size={12} /></button>
        </div>
      )}

      {recording && (
        <div className="chat-recording-row">
          <span className="chat-recording-dot" />
          {t("recording")} {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
          <button className="icon-btn xs" onClick={cancelRecording} title={t("cancel")}><X size={12} /></button>
        </div>
      )}

      <form onSubmit={send} className="chat-input-row" style={{ position: "relative" }}>
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFilePick} />
        <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()} title={t("attachFile")}>
          <Paperclip size={16} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setShowEmoji((v) => !v)} title={t("emoji")}>
          <Smile size={16} />
        </button>
        {showEmoji && (
          <div className="emoji-picker">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                className="emoji-option"
                onClick={() => { setText((t2) => t2 + em); setShowEmoji(false); }}
              >
                {em}
              </button>
            ))}
          </div>
        )}
        <input value={text} onChange={handleTextChange} placeholder={t("typeMessage")} disabled={recording} />
        {text.trim() || pendingFile ? (
          <button type="submit" className="btn-primary sm" disabled={sending}>
            <Send size={14} />
          </button>
        ) : (
          <button
            type="button"
            className={`icon-btn ${recording ? "recording-active" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            title={t("recordVoiceNote")}
          >
            <Mic size={16} />
          </button>
        )}
      </form>
    </div>
  );
}

export { ChatThread as default };
