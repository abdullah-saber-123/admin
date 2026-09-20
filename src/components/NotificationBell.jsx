import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, AlertOctagon, CalendarClock, HeartCrack, AtSign } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

export default function NotificationBell({ kpis, syncStatus, isAdmin, onGoToDashboard, onSelectBucket, onSelectCustomer }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [mentions, setMentions] = useState([]);
  const seenIds = useRef(null); // null until the first fetch, so existing unread ones don't all pop toasts at once

  const loadMentions = useCallback(() => {
    api.notifications().then((res) => {
      const results = res.results || [];
      if (seenIds.current) {
        // A side toast (auto-dismisses in 7s, or close it manually) for
        // anything new since the last poll - the bell dropdown alone is
        // easy to miss while working elsewhere on the page.
        for (const n of results) {
          if (!n.is_read && !seenIds.current.has(n.id)) {
            showToast(n.message, "info", 7000);
          }
        }
      }
      seenIds.current = new Set(results.map((n) => n.id));
      setMentions(results);
    }).catch(() => {});
  }, [showToast]);

  useEffect(() => {
    loadMentions();
    const interval = setInterval(loadMentions, 60000); // poll every minute
    return () => clearInterval(interval);
  }, [loadMentions]);

  const handleMentionClick = async (n) => {
    if (!n.is_read) {
      try { await api.markNotificationRead(n.id); } catch { /* non-fatal */ }
    }
    if (n.partner_id) onSelectCustomer?.(n.partner_id);
    setOpen(false);
    loadMentions();
  };

  const items = [];
  if (isAdmin && syncStatus?.consecutive_failures >= 2) {
    items.push({
      key: "sync",
      icon: AlertOctagon,
      tone: "danger",
      text: t("syncFailingBanner").replace("{n}", syncStatus.consecutive_failures),
      onClick: () => { onGoToDashboard(); setOpen(false); },
    });
  }
  if (kpis?.followup_today_count > 0) {
    items.push({
      key: "followup",
      icon: CalendarClock,
      tone: "info",
      text: `${kpis.followup_today_count} ${t("followupsTodayBanner")}`,
      onClick: () => { onSelectBucket("followup_today"); setOpen(false); },
    });
  }
  if (kpis?.broken_promise_count > 0) {
    items.push({
      key: "broken",
      icon: HeartCrack,
      tone: "danger",
      text: `${kpis.broken_promise_count} ${t("brokenPromises")}`,
      onClick: () => { onSelectBucket("broken_promise"); setOpen(false); },
    });
  }

  const unreadMentions = mentions.filter((m) => !m.is_read);
  const totalCount = items.length + unreadMentions.length;

  return (
    <div className="notif-bell-wrap">
      <button className="icon-btn notif-bell-btn" onClick={() => setOpen((v) => !v)} title={t("notifications")}>
        <Bell size={17} />
        {totalCount > 0 && <span className="notif-badge">{totalCount}</span>}
      </button>
      {open && (
        <>
          <div className="columns-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-dropdown-head">{t("notifications")}</div>
            {items.length === 0 && mentions.length === 0 ? (
              <div className="notif-empty">{t("noNotifications")}</div>
            ) : (
              <div className="notif-dropdown-list">
                {items.map((it) => (
                  <button key={it.key} className={`notif-item ${it.tone}`} onClick={it.onClick}>
                    <it.icon size={15} />
                    <span>{it.text}</span>
                  </button>
                ))}
                {mentions.map((m) => (
                  <button key={`m-${m.id}`} className={`notif-item mention ${m.is_read ? "read" : ""}`} onClick={() => handleMentionClick(m)}>
                    <AtSign size={15} />
                    <span>
                      {m.message}
                      {m.partner_name && <span className="notif-item-sub">{m.partner_name}</span>}
                    </span>
                    {!m.is_read && <span className="notif-item-dot" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
