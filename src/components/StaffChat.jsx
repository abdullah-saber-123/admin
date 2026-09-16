import { useEffect, useState } from "react";
import { MessageSquare, Phone, Users, Megaphone, History } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import Avatar from "./Avatar.jsx";
import ChatThread from "./ChatThread.jsx";
import AnnouncementComposeModal from "./AnnouncementComposeModal.jsx";
import { subscribeSignal } from "../callSocket.js";

export default function StaffChat({ role, username, callOverlayRef, onOpenAnnouncementHistory }) {
  const { t } = useLang();
  const [threads, setThreads] = useState(null);
  const [selected, setSelected] = useState(null);
  const [groupSelectOpen, setGroupSelectOpen] = useState(false);
  const [groupSelection, setGroupSelection] = useState([]);
  const [announceOpen, setAnnounceOpen] = useState(false);

  // Same thread-list layout everyone already knew from admin's view - now
  // populated with every other teammate (staff or admin) instead of just
  // "my thread with admin", so any two people can message each other.
  useEffect(() => {
    const applyContacts = (data) => {
      // Defensive: whatever comes back, only ever store an array here -
      // an unexpected shape (or a caught error upstream) must never leave
      // `threads` as something .find()/.map() can't be called on.
      const list = Array.isArray(data) ? data : [];
      setThreads(list);
      setSelected((prev) => prev || (list.length > 0 ? list[0].username : null));
    };
    api.staffChatContacts().then(applyContacts).catch(() => setThreads([]));
    const interval = setInterval(() => {
      api.staffChatContacts().then((data) => setThreads(Array.isArray(data) ? data : [])).catch(() => {});
    }, 8000);
    const unsubscribe = subscribeSignal((data) => {
      if (data.type === "new_message") {
        api.staffChatContacts().then((d) => setThreads(Array.isArray(d) ? d : [])).catch(() => {});
      }
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const selectedThread = (threads || []).find((th) => th.username === selected);

  const startGroupCall = () => {
    if (groupSelection.length === 0) return;
    callOverlayRef?.current?.startGroupCall(groupSelection, t("groupCall"));
    setGroupSelectOpen(false);
    setGroupSelection([]);
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}><MessageSquare size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("staffChatTitle")}</h2>
          <p className="panel-sub">{t("staffChatHint")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary sm" onClick={onOpenAnnouncementHistory}>
            <History size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("announcementHistoryTitle")}
          </button>
          {role === "admin" && (
            <button className="btn-secondary sm" onClick={() => setAnnounceOpen(true)}>
              <Megaphone size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {t("sendAnnouncement")}
            </button>
          )}
          <button className="btn-secondary sm" onClick={() => setGroupSelectOpen(true)}>
            <Users size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("groupCall")}
          </button>
        </div>
      </div>

      {announceOpen && (
        <AnnouncementComposeModal contacts={threads} onClose={() => setAnnounceOpen(false)} />
      )}

      {groupSelectOpen && (
        <div className="overlay modal-overlay" onClick={() => setGroupSelectOpen(false)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("groupCall")}</h3>
            <p className="prompt-message">{t("selectStaffToCall")}</p>
            <div className="multiselect-list">
              {(threads || []).map((th) => (
                <label key={th.username} className="multiselect-item">
                  <input
                    type="checkbox"
                    checked={groupSelection.includes(th.username)}
                    onChange={() => {
                      setGroupSelection((prev) =>
                        prev.includes(th.username) ? prev.filter((u) => u !== th.username) : [...prev, th.username]
                      );
                    }}
                  />
                  {th.full_name || th.username}
                </label>
              ))}
            </div>
            <div className="prompt-actions">
              <button className="btn-secondary" onClick={() => setGroupSelectOpen(false)}>{t("cancel")}</button>
              <button className="btn-primary" disabled={groupSelection.length === 0} onClick={startGroupCall}>
                <Phone size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("startGroupCall")} ({groupSelection.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, height: 520 }}>
        <div className="panel" style={{ overflowY: "auto", padding: 10 }}>
          {!threads && <div className="loading-state">{t("loadingDots")}</div>}
          {threads && threads.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
          {threads && threads.map((th) => (
            <div
              key={th.username}
              className={`chat-thread-item ${selected === th.username ? "active" : ""}`}
              onClick={() => setSelected(th.username)}
            >
              <div className="avatar-wrap">
                <Avatar name={th.full_name || th.username} size="sm" />
                {th.online && <span className="avatar-online-dot" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12.5 }}>{th.full_name || th.username}</strong>
                  {th.unread_count > 0 && <span className="chat-unread-badge">{th.unread_count}</span>}
                </div>
                <div className="chat-thread-preview">{th.last_message || t("noActivity")}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          {selectedThread ? (
            <ChatThread
              username={selectedThread.username}
              myUsername={username}
              phone={selectedThread.phone}
              online={selectedThread.online}
              onCall={() => callOverlayRef?.current?.startCall(selectedThread.username, selectedThread.full_name || selectedThread.username)}
            />
          ) : (
            <div className="panel empty-state" style={{ height: "100%" }}>{t("noActivity")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
