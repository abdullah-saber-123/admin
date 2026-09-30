import { useEffect, useState, useCallback } from "react";
import { Bell, AtSign, CheckCheck } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";

const PAGE_SIZE = 30;

export default function NotificationsModule({ onSelectCustomer }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setError(null);
    api.notificationsPage({ page, limit: PAGE_SIZE, unread_only: unreadOnly }).then(setData).catch((e) => setError(e.message));
  }, [page, unreadOnly]);

  useEffect(load, [load]);
  useEffect(() => { setPage(1); }, [unreadOnly]);

  const handleClick = async (n) => {
    if (!n.is_read) {
      try { await api.markNotificationRead(n.id); } catch { /* non-fatal */ }
      load();
    }
    if (n.partner_id) onSelectCustomer?.(n.partner_id);
  };

  const handleMarkAllRead = async () => {
    try { await api.markAllNotificationsRead(); } catch { /* non-fatal */ }
    load();
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total_count / PAGE_SIZE)) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Bell size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("notificationsModuleTitle")}</h2>
            <p className="panel-sub">{t("notificationsModuleHint")}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label className="checkbox-inline" style={{ margin: 0 }}>
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              {t("unreadOnly")}
            </label>
            <button className="btn-secondary sm" onClick={handleMarkAllRead} disabled={!data || data.unread_count === 0}>
              <CheckCheck size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {t("markAllRead")}
            </button>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {data.results.map((n) => (
                <button key={n.id} className={`notif-item mention ${n.is_read ? "read" : ""}`} style={{ width: "100%" }} onClick={() => handleClick(n)}>
                  <AtSign size={15} />
                  <span>
                    {n.message}
                    {n.partner_name && <span className="notif-item-sub">{n.partner_name}</span>}
                    <span className="notif-item-sub">{fmtDateTime(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="notif-item-dot" />}
                </button>
              ))}
              {data.results.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>{t("noNotifications")}</div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
                <span className="page-info"><bdi>{page} / {totalPages} · {data.total_count}</bdi></span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
