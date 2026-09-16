import { useEffect, useState } from "react";
import { MessageSquare, X, ChevronLeft, Phone, Megaphone } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import Avatar from "./Avatar.jsx";
import ChatThread from "./ChatThread.jsx";
import AnnouncementComposeModal from "./AnnouncementComposeModal.jsx";
import { subscribeSignal } from "../callSocket.js";

export default function ChatWidget({ callOverlayRef }) {
  const { t } = useLang();
  const session = getSession();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState(null);
  const [selected, setSelected] = useState(null);
  const [announceOpen, setAnnounceOpen] = useState(false);

  useEffect(() => {
    if (!session) return undefined;
    const load = () => {
      api.staffChatContacts().then((data) => setThreads(Array.isArray(data) ? data : [])).catch(() => {});
    };
    load();
    const interval = setInterval(load, 8000);
    // Instant refresh the moment someone sends a message our way, instead of
    // waiting for the next poll - the backend pushes this over the same
    // socket already used for calls/typing.
    const unsubscribe = subscribeSignal((data) => {
      if (data.type === "new_message") load();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username]);

  if (!session) return null;

  const totalUnread = (threads || []).reduce((s, th) => s + (th.unread_count || 0), 0);
  const selectedThread = (threads || []).find((th) => th.username === selected);

  return (
    <div className="chat-widget">
      {!open && (
        <button className="chat-widget-pill" onClick={() => setOpen(true)} title={t("staffChatTitle")}>
          <MessageSquare size={18} />
          {totalUnread > 0 && <span className="chat-widget-badge">{totalUnread}</span>}
        </button>
      )}

      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            {selectedThread ? (
              <>
                <button className="icon-btn" onClick={() => setSelected(null)} title={t("back")}>
                  <ChevronLeft size={16} />
                </button>
                <Avatar name={selectedThread.full_name || selectedThread.username} size="sm" />
                <div className="chat-widget-header-name">
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedThread.full_name || selectedThread.username}
                  </div>
                  {selectedThread.online && <div className="online-status-text">{t("online")}</div>}
                </div>
                <button
                  className="icon-btn"
                  onClick={() => callOverlayRef?.current?.startCall(selectedThread.username, selectedThread.full_name || selectedThread.username)}
                  title={t("callInApp")}
                >
                  <Phone size={15} />
                </button>
              </>
            ) : (
              <strong className="chat-widget-header-name">{t("staffChatTitle")}</strong>
            )}
            {!selectedThread && session.role === "admin" && (
              <button className="icon-btn" onClick={() => setAnnounceOpen(true)} title={t("sendAnnouncement")}>
                <Megaphone size={15} />
              </button>
            )}
            <button className="icon-btn" onClick={() => setOpen(false)} title={t("cancel")}>
              <X size={16} />
            </button>
          </div>

          {announceOpen && (
            <AnnouncementComposeModal contacts={threads} onClose={() => setAnnounceOpen(false)} />
          )}

          {!selectedThread ? (
            <div className="chat-widget-list">
              {!threads && <div className="loading-state">{t("loadingDots")}</div>}
              {threads && threads.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
              {threads && threads.map((th) => (
                <div key={th.username} className="chat-thread-item" onClick={() => setSelected(th.username)}>
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
          ) : (
            <div className="chat-widget-thread">
              <ChatThread
                username={selectedThread.username}
                myUsername={session.username}
                phone={selectedThread.phone}
                onCall={() => callOverlayRef?.current?.startCall(selectedThread.username, selectedThread.full_name || selectedThread.username)}
                compact
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
