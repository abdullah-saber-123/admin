import { useEffect, useState } from "react";
import { Activity, X, Megaphone, Circle, AlertTriangle, AlertCircle } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import Avatar from "./Avatar.jsx";
import RiyalAmount from "./RiyalAmount.jsx";
import AnnouncementComposeModal from "./AnnouncementComposeModal.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";

function PendingListModal({ collector, onClose, onNudge, t, statusLabel }) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    api.dailyActivityPending(collector.id).then(setPending).catch(() => setPending([]));
  }, [collector.id]);

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 520, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{collector.full_name || collector.username} — {t("stillPendingLabel")}</h3>
        {!pending && <div className="loading-state">{t("loadingDots")}</div>}
        {pending && pending.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
        {pending && pending.length > 0 && (
          <div className="fu-history">
            {pending.map((c) => (
              <div key={c.partner_id} className="fu-entry">
                <div className="fu-entry-top">
                  <span className="fu-tag sm">{statusLabel(c.follow_up_status)}</span>
                  <span className="fu-entry-meta">{c.days_overdue > 0 ? t("myDayOverdueBy").replace("{n}", c.days_overdue) : t("myDayDueToday")}</span>
                </div>
                <div className="fu-entry-note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span><strong>{c.name}</strong> — <RiyalAmount amount={c.current_due} /></span>
                  <button className="btn-secondary sm" onClick={() => onNudge(collector, c)}>
                    <Megaphone size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                    {t("nudgeButton")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FlagBadge({ flag, t }) {
  if (flag === "critical") {
    return <span className="fu-tag sm danger" title={t("flagCriticalHint")}><AlertCircle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("flagCritical")}</span>;
  }
  if (flag === "warning") {
    return <span className="fu-tag sm warn" title={t("flagWarningHint")}><AlertTriangle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("flagWarning")}</span>;
  }
  return <span className="fu-tag sm ok">{t("flagOk")}</span>;
}

export default function DailyActivityReport({ isSupervisor = false }) {
  const { t, money, statusLabel } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [pendingModalFor, setPendingModalFor] = useState(null);
  const [nudgeTarget, setNudgeTarget] = useState(null);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    api.dailyActivityReport().then(setData).catch((e) => setError(e.message));
    api.staffList().then(setStaffList).catch(() => {});
    if (!isSupervisor) api.adminAttendance().then(setAttendance).catch(() => {});
  }, [isSupervisor]);

  const attendanceByUsername = {};
  (attendance?.collectors || []).forEach((a) => { attendanceByUsername[a.username] = a; });

  const handleNudge = (collector, customer) => {
    setPendingModalFor(null);
    setNudgeTarget({ collector, customer });
  };

  const rows = data?.collectors || [];
  const totalQueue = rows.reduce((s, r) => s + r.queue_count, 0);
  const totalDone = rows.reduce((s, r) => s + r.completed_today, 0);
  const totalCollectedToday = rows.reduce((s, r) => s + r.collected_today, 0);
  const totalCollectedYesterday = rows.reduce((s, r) => s + r.collected_yesterday, 0);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Activity size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("dailyActivityTitle")}</h2>
        <p className="panel-sub">{t("dailyActivityHint")} {isSupervisor && `— ${t("supervisorDashboardHint")}`}</p>
        {data && <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 14px" }}>{fmtDate(data.date)}</p>}

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("totalFollowupsLabel")}</div></div>
                <div className="insights-kpi-value">{totalQueue}</div>
              </div>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("doneTodayLabel")}</div></div>
                <div className="insights-kpi-value">{totalDone} / {totalQueue}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("totalCollectedFromFollowupsLabel")}</div></div>
                <div className="insights-kpi-value">{money(totalCollectedToday)}</div>
                <div className="my-day-city">{t("yesterdayLabel")}: {money(totalCollectedYesterday)}</div>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state">{t("noActivity")}</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("collectorField")}</th>
                      <th>{t("todayProgressLabel")}</th>
                      <th>{t("stillPendingLabel")}</th>
                      <th>{t("totalCollectedFromFollowupsLabel")}</th>
                      <th>{t("yesterdayLabel")}</th>
                      <th>{t("dailyTargetLabel")}</th>
                      <th>{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const pct = r.queue_count ? Math.round((r.completed_today / r.queue_count) * 100) : 0;
                      const diff = r.collected_today - r.collected_yesterday;
                      return (
                        <tr key={r.id}>
                          <td data-label={t("collectorField")}>
                            <div className="cust-cell">
                              <Avatar name={r.username} size="sm" />
                              <span className="cust-name">{r.full_name || r.username}</span>
                              {attendanceByUsername[r.username]?.clock_in && !attendanceByUsername[r.username]?.clock_out && (
                                <Circle size={8} className="my-day-attendance-dot online" title={t("clockedInNote")} />
                              )}
                            </div>
                          </td>
                          <td data-label={t("todayProgressLabel")}>
                            <span className="work-bar">
                              <span className="work-bar-track">
                                <span className="work-bar-fill paid" style={{ width: `${pct}%` }} />
                              </span>
                              <span className="work-bar-label">{r.completed_today}/{r.queue_count}</span>
                            </span>
                          </td>
                          <td data-label={t("stillPendingLabel")}>
                            {r.pending_count > 0 ? (
                              <span className="fu-tag sm warn clickable-row" onClick={() => setPendingModalFor(r)}>{r.pending_count}</span>
                            ) : "—"}
                          </td>
                          <td data-label={t("totalCollectedFromFollowupsLabel")}><strong><RiyalAmount amount={r.collected_today} /></strong></td>
                          <td data-label={t("yesterdayLabel")}>
                            <RiyalAmount amount={r.collected_yesterday} />
                            {diff !== 0 && (
                              <span className={diff > 0 ? "my-day-diff-down" : "my-day-diff-up"} style={{ marginInlineStart: 6 }}>
                                {diff > 0 ? "▲" : "▼"}
                              </span>
                            )}
                          </td>
                          <td data-label={t("dailyTargetLabel")}>
                            {r.daily_collection_target > 0 || r.daily_contact_target > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5 }}>
                                {r.daily_collection_target > 0 && (
                                  <span>{t("collectedLabel")}: {r.collection_pct}% <span style={{ color: "var(--text-dim)" }}>({money(r.daily_collection_target)})</span></span>
                                )}
                                {r.daily_contact_target > 0 && (
                                  <span>{t("contactsLabel")}: {r.contacts_today}/{r.daily_contact_target} ({r.contact_pct}%)</span>
                                )}
                              </div>
                            ) : "—"}
                          </td>
                          <td data-label={t("status")}><FlagBadge flag={r.flag} t={t} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {pendingModalFor && (
        <PendingListModal collector={pendingModalFor} onClose={() => setPendingModalFor(null)} onNudge={handleNudge} t={t} statusLabel={statusLabel} />
      )}
      {nudgeTarget && (
        <AnnouncementComposeModal
          contacts={staffList}
          initialSelected={[nudgeTarget.collector.username]}
          initialMessage={t("nudgeMessageTemplate").replace("{name}", nudgeTarget.customer.name)}
          partnerId={nudgeTarget.customer.partner_id}
          onClose={() => setNudgeTarget(null)}
        />
      )}
    </div>
  );
}
