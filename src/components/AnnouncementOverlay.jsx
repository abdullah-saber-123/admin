import { useEffect, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";
import { subscribeSignal } from "../callSocket.js";

export default function AnnouncementOverlay() {
  const { t } = useLang();
  const session = getSession();
  const [queue, setQueue] = useState([]);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);

  const loadPending = () => {
    api.getPendingAnnouncements().then(setQueue).catch(() => {});
  };

  useEffect(() => {
    if (!session) return undefined;
    loadPending();
    const interval = setInterval(loadPending, 20000);
    const unsubscribe = subscribeSignal((data) => {
      if (data.type === "announcement") loadPending();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username]);

  if (!session || queue.length === 0) return null;

  const current = queue[0];

  const handleAcknowledge = async () => {
    setSending(true);
    try {
      await api.acknowledgeAnnouncement(current.id, responseText.trim() || null);
      setResponseText("");
      setQueue((q) => q.slice(1));
    } catch {
      /* keep the overlay up - they can retry */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="announcement-overlay">
      <div className="announcement-card">
        <div className="announcement-icon"><Megaphone size={28} /></div>
        <div className="announcement-from">{t("announcementFrom")}: <strong>{current.created_by}</strong></div>
        <div className="announcement-time">{fmtDateTime(current.created_at)}</div>
        {current.customer_name && (
          <div className="announcement-customer-tag">{current.customer_name}</div>
        )}
        <div className="announcement-message">{current.message}</div>

        <textarea
          className="announcement-response"
          placeholder={t("announcementResponsePlaceholder")}
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          rows={3}
        />

        <button className="btn-primary announcement-ack-btn" onClick={handleAcknowledge} disabled={sending}>
          <Send size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
          {sending ? t("sending") : t("announcementAcknowledge")}
        </button>

        {queue.length > 1 && (
          <div className="announcement-queue-note">{t("announcementMoreWaiting").replace("{n}", queue.length - 1)}</div>
        )}
      </div>
    </div>
  );
}
