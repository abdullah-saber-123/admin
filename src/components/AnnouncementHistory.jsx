import { useEffect, useState } from "react";
import { History, Check, Clock } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";

export default function AnnouncementHistory({ onSelectCustomer }) {
  const { t } = useLang();
  const session = getSession();
  const isAdmin = session?.role === "admin";
  const [announcements, setAnnouncements] = useState(null);
  const [myHistory, setMyHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      api.listAnnouncements().then(setAnnouncements).catch((e) => setError(e.message));
    } else {
      api.myAnnouncementHistory().then(setMyHistory).catch((e) => setError(e.message));
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="content-stack" style={{ maxWidth: 640 }}>
        <div className="panel">
          <h2><History size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("announcementHistoryTitle")}</h2>
          <p className="panel-sub">{t("myAnnouncementHistoryHint")}</p>

          {error && <div className="error-state">{error}</div>}
          {!error && !myHistory && <div className="loading-state">{t("loadingDots")}</div>}
          {myHistory && myHistory.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

          {myHistory && myHistory.map((ann) => (
            <div key={ann.id} className="announcement-history-card">
              <div className="announcement-history-top">
                <div>
                  <strong>{ann.created_by}</strong>
                  <span className="my-day-city"> · {fmtDateTime(ann.created_at)}</span>
                  {ann.customer_name && (
                    <span className="fu-tag sm warn" style={{ marginInlineStart: 8, cursor: "pointer" }} onClick={() => onSelectCustomer?.(ann.partner_id)}>
                      {ann.customer_name}
                    </span>
                  )}
                </div>
                <span className={`fu-tag sm ${ann.acknowledged ? "ok" : "faint"}`}>
                  {ann.acknowledged ? t("acknowledgedLabel") : t("installmentStatus_pending")}
                </span>
              </div>
              <div className="announcement-history-message">{ann.message}</div>
              {ann.response && <div className="announcement-history-response">{t("announcementResponsePlaceholder")}: "{ann.response}"</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="content-stack" style={{ maxWidth: 720 }}>
      <div className="panel">
        <h2><History size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("announcementHistoryTitle")}</h2>
        <p className="panel-sub">{t("announcementHistoryHint")}</p>

        {error && <div className="error-state">{error}</div>}
        {!error && !announcements && <div className="loading-state">{t("loadingDots")}</div>}
        {announcements && announcements.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {announcements && announcements.map((ann) => {
          const ackCount = ann.recipients.filter((r) => r.acknowledged).length;
          return (
            <div key={ann.id} className="announcement-history-card">
              <div className="announcement-history-top">
                <div>
                  <strong>{ann.created_by}</strong>
                  <span className="my-day-city"> · {fmtDateTime(ann.created_at)}</span>
                  {ann.customer_name && (
                    <span className="fu-tag sm warn" style={{ marginInlineStart: 8, cursor: "pointer" }} onClick={() => onSelectCustomer?.(ann.partner_id)}>
                      {ann.customer_name}
                    </span>
                  )}
                </div>
                <span className="fu-tag sm ok">{ackCount}/{ann.recipients.length} {t("acknowledgedLabel")}</span>
              </div>
              <div className="announcement-history-message">{ann.message}</div>
              <div className="announcement-history-recipients">
                {ann.recipients.map((r) => (
                  <div key={r.username} className={`announcement-history-recipient ${r.acknowledged ? "ok" : "pending"}`}>
                    {r.acknowledged ? <Check size={12} /> : <Clock size={12} />}
                    <span>{r.username}</span>
                    {r.acknowledged_at && <span className="my-day-city">{fmtDateTime(r.acknowledged_at)}</span>}
                    {r.response && <span className="announcement-history-response">"{r.response}"</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
