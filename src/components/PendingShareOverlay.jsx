import { useEffect, useState } from "react";
import { Share2, Check, X } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";
import { subscribeSignal } from "../callSocket.js";

export default function PendingShareOverlay() {
  const { t } = useLang();
  const session = getSession();
  const [queue, setQueue] = useState([]);
  const [responding, setResponding] = useState(false);

  const loadPending = () => {
    api.listTempAccess().then((rows) => {
      setQueue(rows.filter((r) => r.status === "pending" && r.granted_to === session?.username));
    }).catch(() => {});
  };

  useEffect(() => {
    if (!session) return undefined;
    loadPending();
    const interval = setInterval(loadPending, 20000);
    const unsubscribe = subscribeSignal((data) => {
      if (data.type === "share_request") loadPending();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username]);

  if (!session || queue.length === 0) return null;

  const current = queue[0];

  const handleRespond = async (accept) => {
    setResponding(true);
    try {
      await api.respondTempAccess(current.id, accept);
      setQueue((q) => q.slice(1));
    } catch {
      /* keep the card up - they can retry */
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="pending-share-overlay">
      <div className="pending-share-card">
        <div className="pending-share-icon"><Share2 size={18} /></div>
        <div className="pending-share-heading">{t("pendingShareRequestHeading")}</div>
        <div className="pending-share-body">
          <strong>{current.granted_by_name}</strong> {t("pendingShareRequestFrom")}: <strong>{current.customer_name}</strong>
        </div>
        {current.reason && <div className="pending-share-reason">{current.reason}</div>}
        <div className="pending-share-expiry">{t("expiresLabel")} {fmtDateTime(current.expires_at)}</div>

        <div className="pending-share-actions">
          <button className="btn-primary sm" disabled={responding} onClick={() => handleRespond(true)}>
            <Check size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("accept")}
          </button>
          <button className="btn-secondary sm danger" disabled={responding} onClick={() => handleRespond(false)}>
            <X size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("decline")}
          </button>
        </div>

        {queue.length > 1 && (
          <div className="pending-share-more">{t("pendingShareMoreWaiting").replace("{n}", queue.length - 1)}</div>
        )}
      </div>
    </div>
  );
}
