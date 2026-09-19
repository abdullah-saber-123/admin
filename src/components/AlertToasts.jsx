// Once-a-day side toasts (never push notifications) - a collector sees their
// own "due today" / "gone quiet" counts, an admin sees which collectors are
// actually falling behind. Dismissing one hides it until tomorrow.
import { useEffect, useState } from "react";
import { CalendarClock, AlertCircle, AlertTriangle, X } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";

const DISMISS_PREFIX = "collect_alerts_dismissed_";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDismissed() {
  try {
    // Only today's dismissals matter - clear out any older day's key so this
    // doesn't grow forever.
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DISMISS_PREFIX) && k !== DISMISS_PREFIX + todayKey())
      .forEach((k) => localStorage.removeItem(k));
    const saved = localStorage.getItem(DISMISS_PREFIX + todayKey());
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(DISMISS_PREFIX + todayKey(), JSON.stringify([...set]));
  } catch { /* best effort */ }
}

function ToastCard({ variant, icon, title, text, actions, onClose }) {
  const tone = {
    violet: { bar: "#714b67", iconBg: "#f3ebf1", iconColor: "#714b67", btn: "#714b67" },
    danger: { bar: "#e5484d", iconBg: "#fcebec", iconColor: "#e5484d", btn: "#e5484d" },
    warning: { bar: "#c98a1c", iconBg: "#fbf1de", iconColor: "#c98a1c", btn: "#c98a1c" },
  }[variant];

  return (
    <div className="alert-toast-card">
      <div className="alert-toast-topbar" style={{ background: tone.bar }} />
      <div className="alert-toast-body">
        <div className="alert-toast-header">
          <div className="alert-toast-header-left">
            <div className="alert-toast-icon" style={{ background: tone.iconBg, color: tone.iconColor }}>
              {icon}
            </div>
            <div className="alert-toast-title">{title}</div>
          </div>
          <button className="alert-toast-close" onClick={onClose} aria-label="close">
            <X size={15} />
          </button>
        </div>
        <div className="alert-toast-text">{text}</div>
        <div className="alert-toast-actions">
          {actions.map((a, i) => (
            <button
              key={i}
              className={a.secondary ? "alert-toast-btn alert-toast-btn-secondary" : "alert-toast-btn"}
              style={a.secondary ? undefined : { background: tone.btn }}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AlertToasts({ role, onViewDueToday, onViewNeglected, onReviewCollector }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(loadDismissed);

  useEffect(() => {
    api.todayAlerts().then(setData).catch(() => {});
  }, []);

  const dismiss = (key) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(key);
      saveDismissed(next);
      return next;
    });
  };

  if (!data) return null;

  const cards = [];

  if (role !== "admin") {
    if (data.due_today_count > 0 && !dismissed.has("due_today")) {
      cards.push(
        <ToastCard
          key="due_today"
          variant="violet"
          icon={<CalendarClock size={17} />}
          title={t("alertDueTodayTitle")}
          text={t("alertDueTodayText").replace("{n}", data.due_today_count)}
          actions={[{ label: t("alertViewList"), onClick: () => { onViewDueToday?.(); dismiss("due_today"); } }]}
          onClose={() => dismiss("due_today")}
        />
      );
    }
    if (data.neglected_count > 0 && !dismissed.has("neglected")) {
      cards.push(
        <ToastCard
          key="neglected"
          variant="danger"
          icon={<AlertCircle size={17} />}
          title={t("alertNeglectedTitle")}
          text={t("alertNeglectedText").replace("{n}", data.neglected_count)}
          actions={[{ label: t("alertViewCustomers"), onClick: () => { onViewNeglected?.(); dismiss("neglected"); } }]}
          onClose={() => dismiss("neglected")}
        />
      );
    }
  } else {
    (data.flagged_collectors || []).forEach((c) => {
      const key = `collector_${c.username}`;
      if (dismissed.has(key)) return;
      const parts = [];
      if (c.reasons.includes("overdue_no_collection")) {
        parts.push(t("alertAdminOverdueNoCollection").replace("{n}", c.overdue_count));
      }
      if (c.reasons.includes("neglected_customers")) {
        parts.push(t("alertAdminNeglected").replace("{n}", c.neglected_count));
      }
      cards.push(
        <ToastCard
          key={key}
          variant="warning"
          icon={<AlertTriangle size={17} />}
          title={t("alertAdminTitle")}
          text={
            <>
              <strong>{c.full_name || c.username}</strong>: {parts.join(t("alertAdminJoiner"))}
            </>
          }
          actions={[
            { label: t("alertReviewCollector"), onClick: () => { onReviewCollector?.(c.salesperson_name); dismiss(key); } },
            { label: t("alertDismissToday"), secondary: true, onClick: () => dismiss(key) },
          ]}
          onClose={() => dismiss(key)}
        />
      );
    });
  }

  if (cards.length === 0) return null;

  return <div className="alert-toast-stack">{cards}</div>;
}
