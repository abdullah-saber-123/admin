import { useEffect, useState, useRef } from "react";
import { Sun, Phone, MessageCircle, ChevronRight, X, Receipt, Wallet, ClipboardList, Download, AlertTriangle, ListChecks, Clock, LogIn, LogOut, Lightbulb, PlayCircle, SkipForward, ArrowLeft, Check, List, Timer, PartyPopper, Gauge, TrendingUp, TrendingDown, Calculator, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import RiskBadge from "./RiskBadge.jsx";

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};
const CHART_COLORS = ["#714b67", "#30C381", "#F4A460", "#D6145F", "#5750f1", "#2C8397", "#F7CD1F"];

// How long a carried-forward item has been sitting since it became due,
// formatted as a live-updating "Xh Ym pending" - hours/minutes read as more
// urgent than a flat day count once something's genuinely overdue.
function formatSlaElapsed(dueDateStr, nowMs, t) {
  if (!dueDateStr) return null;
  const dueMs = new Date(dueDateStr + "T00:00:00").getTime();
  const elapsedMs = nowMs - dueMs;
  if (elapsedMs <= 0) return null;
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  let label;
  if (days > 0) label = `${days}${t("slaDaysShort")} ${hours}${t("slaHoursShort")}`;
  else label = `${hours}${t("slaHoursShort")} ${minutes}${t("slaMinutesShort")}`;
  let urgency = "normal";
  if (totalMinutes >= 72 * 60) urgency = "critical";
  else if (totalMinutes >= 24 * 60) urgency = "high";
  return { label, urgency };
}

function SlaTimerBadge({ dueDateStr, nowMs, t }) {
  const sla = formatSlaElapsed(dueDateStr, nowMs, t);
  if (!sla) return null;
  return (
    <span className={`my-day-sla-badge ${sla.urgency}`} title={t("slaTimerHint")}>
      <Timer size={10} /> {sla.label} {t("slaPendingSuffix")}
    </span>
  );
}

function TargetGaugeCard({ monthlyTarget, collectedThisMonth, t, money }) {
  if (!monthlyTarget) return null;
  const pct = Math.min(100, Math.round((collectedThisMonth / monthlyTarget) * 100));
  const gaugeData = [{ name: "target", value: pct, fill: pct >= 100 ? "#30C381" : pct >= 60 ? "#5750f1" : "#F4A460" }];
  return (
    <div className="my-day-gauge-card">
      <div className="my-day-gauge-title"><Gauge size={13} /> {t("targetGaugeTitle")}</div>
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={10} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="my-day-gauge-value">{pct}%</div>
      <div className="my-day-gauge-sub">{money(collectedThisMonth)} / {money(monthlyTarget)}</div>
    </div>
  );
}

function DailyTargetCard({ dailyTarget, t, money }) {
  if (!dailyTarget) return null;
  const { collection_target, contact_target, collected_today, contacts_today, collection_pct, contact_pct, flag } = dailyTarget;
  const collectionRemaining = collection_target > 0 ? Math.max(0, collection_target - collected_today) : 0;
  const contactRemaining = contact_target > 0 ? Math.max(0, contact_target - contacts_today) : 0;

  let guidance;
  if (flag === "critical") guidance = t("dailyTargetGuidanceCritical");
  else if (flag === "warning") guidance = t("dailyTargetGuidanceWarning");
  else if (contact_target > 0 && contactRemaining > 0) guidance = t("dailyTargetGuidanceRemainingContacts").replace("{n}", contactRemaining);
  else if (collection_target > 0 && collectionRemaining > 0) guidance = t("dailyTargetGuidanceRemainingAmount").replace("{amount}", money(collectionRemaining));
  else guidance = t("dailyTargetGuidanceDone");

  return (
    <div className={`my-day-daily-target-card ${flag}`}>
      <div className="my-day-history-title"><Gauge size={13} /> {t("dailyTargetCardTitle")}</div>
      {collection_target > 0 && (
        <div className="my-day-daily-target-row">
          <span>{t("collectedLabel")}</span>
          <span>{money(collected_today)} / {money(collection_target)}</span>
          <div className="my-day-progress-track"><div className="my-day-progress-fill" style={{ width: `${Math.min(100, collection_pct || 0)}%` }} /></div>
        </div>
      )}
      {contact_target > 0 && (
        <div className="my-day-daily-target-row">
          <span>{t("contactsLabel")}</span>
          <span>{contacts_today} / {contact_target}</span>
          <div className="my-day-progress-track"><div className="my-day-progress-fill" style={{ width: `${Math.min(100, contact_pct || 0)}%` }} /></div>
        </div>
      )}
      <div className={`my-day-daily-target-guidance ${flag}`}>{guidance}</div>
    </div>
  );
}

function HistoricalComparisonCard({ comparison, collectedToday, completedToday, t, money }) {
  if (!comparison) return null;
  const collectedDiff = collectedToday - comparison.collected;
  return (
    <div className="my-day-history-card">
      <div className="my-day-history-title"><TrendingUp size={13} /> {t("historicalComparisonTitle")}</div>
      <div className="my-day-history-row">
        <span>{t("todayLabelShort")}</span>
        <strong>{money(collectedToday)}</strong>
        {completedToday != null && <span className="my-day-city">{completedToday} {t("doneLabel")}</span>}
      </div>
      <div className="my-day-history-row">
        <span>{fmtDate(comparison.date)}</span>
        <strong>{money(comparison.collected)}</strong>
        {comparison.completed_count != null && <span className="my-day-city">{comparison.completed_count}/{comparison.queue_count} {t("doneLabel")}</span>}
      </div>
      {comparison.collected > 0 && (
        <div className={`my-day-history-diff ${collectedDiff >= 0 ? "up" : "down"}`}>
          {collectedDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {money(Math.abs(collectedDiff))} {collectedDiff >= 0 ? t("historyBetter") : t("historyWorse")}
        </div>
      )}
    </div>
  );
}

function CalculatorModal({ customer, onClose, t, money }) {
  const [display, setDisplay] = useState(customer?.current_due ? String(customer.current_due) : "0");
  const [stored, setStored] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (d) => {
    if (waitingForOperand) {
      setDisplay(d);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  };
  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };
  const clearAll = () => {
    setDisplay("0");
    setStored(null);
    setOperator(null);
    setWaitingForOperand(false);
  };
  const backspace = () => setDisplay(display.length > 1 ? display.slice(0, -1) : "0");

  const compute = (a, b, op) => {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? 0 : a / b;
    return b;
  };

  const handleOperator = (nextOperator) => {
    const inputValue = parseFloat(display) || 0;
    if (stored === null) {
      setStored(inputValue);
    } else if (operator) {
      const result = compute(stored, inputValue, operator);
      setStored(result);
      setDisplay(String(result));
    }
    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display) || 0;
    if (operator && stored !== null) {
      setDisplay(String(compute(stored, inputValue, operator)));
      setStored(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  };

  const CALC_KEYS = [
    { label: "C", onClick: clearAll },
    { label: "⌫", onClick: backspace },
    { label: "÷", onClick: () => handleOperator("÷") },
    { label: "×", onClick: () => handleOperator("×") },
    { label: "7", onClick: () => inputDigit("7") },
    { label: "8", onClick: () => inputDigit("8") },
    { label: "9", onClick: () => inputDigit("9") },
    { label: "−", onClick: () => handleOperator("-") },
    { label: "4", onClick: () => inputDigit("4") },
    { label: "5", onClick: () => inputDigit("5") },
    { label: "6", onClick: () => inputDigit("6") },
    { label: "+", onClick: () => handleOperator("+") },
    { label: "1", onClick: () => inputDigit("1") },
    { label: "2", onClick: () => inputDigit("2") },
    { label: "3", onClick: () => inputDigit("3") },
    { label: "=", onClick: handleEquals, primary: true },
    { label: "0", onClick: () => inputDigit("0") },
    { label: ".", onClick: inputDecimal },
  ];

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 300 }}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3><Calculator size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("calculatorTitle")}</h3>
        <div className="my-day-calc-display">
          <div className="my-day-calc-value">{display}</div>
          <div className="my-day-calc-money">{money(parseFloat(display) || 0)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {CALC_KEYS.map((k) => (
            <button
              key={k.label}
              className={k.primary ? "btn-primary" : "btn-secondary"}
              style={{ justifyContent: "center", fontSize: 16, padding: "10px 0", gridColumn: k.label === "0" ? "span 2" : undefined }}
              onClick={k.onClick}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComplianceChecklist({ t }) {
  const items = ["complianceItem1", "complianceItem2", "complianceItem3", "complianceItem4"];
  const [checked, setChecked] = useState({});
  return (
    <div className="my-day-compliance-card">
      <div className="my-day-compliance-title"><ShieldCheck size={13} /> {t("complianceChecklistTitle")}</div>
      {items.map((key) => (
        <label key={key} className="my-day-compliance-item">
          <input type="checkbox" checked={!!checked[key]} onChange={() => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))} />
          {t(key)}
        </label>
      ))}
    </div>
  );
}

function FocusModeView({ queue, quickStatuses, statuses, onQuickOutcome, onQuickCheckin, onUndo, onSnooze, onFullFollowup, onSelectCustomer, onExit, t, statusLabel, money, nowMs }) {
  const [phase, setPhase] = useState("start"); // "start" | "working" | "summary"
  const [filterMode, setFilterMode] = useState("all"); // "carried" | "all"
  const [index, setIndex] = useState(0);
  const [jumpSearch, setJumpSearch] = useState("");
  const [showFullForm, setShowFullForm] = useState(false);
  const [quickOutcomeStatus, setQuickOutcomeStatus] = useState(null);
  const [sessionStats, setSessionStats] = useState({ done: 0, snoozed: 0, skipped: 0, fullFollowups: 0 });
  const [advancing, setAdvancing] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callRunning, setCallRunning] = useState(false);
  const callIntervalRef = useRef(null);

  const carriedForwardCount = queue.filter((c) => c.carried_forward).length;
  const statusCounts = {};
  queue.forEach((c) => { statusCounts[c.follow_up_status] = (statusCounts[c.follow_up_status] || 0) + 1; });
  const workingQueue = filterMode === "carried" ? queue.filter((c) => c.carried_forward)
    : filterMode === "all" ? queue
    : queue.filter((c) => c.follow_up_status === filterMode);
  const total = workingQueue.length;
  const doneCount = workingQueue.filter((c) => c.done_today).length;

  const stopCallTimer = () => {
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
      callIntervalRef.current = null;
    }
    setCallRunning(false);
    setCallSeconds(0);
  };

  const startCallTimer = () => {
    if (callIntervalRef.current) return;
    setCallRunning(true);
    setCallSeconds(0);
    callIntervalRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
  };

  useEffect(() => () => { if (callIntervalRef.current) clearInterval(callIntervalRef.current); }, []);

  if (phase === "start") {
    const currentCount = filterMode === "carried" ? carriedForwardCount : filterMode === "all" ? queue.length : (statusCounts[filterMode] || 0);
    return (
      <div className="my-day-focus-start">
        <PlayCircle size={40} />
        <h3>{t("focusStartTitle")}</h3>
        <p>{t("focusStartHint")}</p>
        <div className="my-day-focus-start-options">
          <button
            className={`my-day-focus-start-option ${filterMode === "all" ? "active" : ""}`}
            onClick={() => setFilterMode("all")}
          >
            <strong>{t("focusFilterAll")}</strong>
            <span>{queue.length} {t("customer")}</span>
          </button>
          <button
            className={`my-day-focus-start-option ${filterMode === "carried" ? "active" : ""}`}
            onClick={() => setFilterMode("carried")}
          >
            <strong>{t("focusFilterCarried")}</strong>
            <span>{carriedForwardCount} {t("customer")}</span>
          </button>
        </div>

        {Object.keys(statusCounts).length > 0 && (
          <div className="my-day-focus-status-filters">
            <div className="my-day-focus-status-filters-label">{t("focusFilterByStatus")}</div>
            <div className="my-day-focus-status-filters-chips">
              {Object.entries(statusCounts).map(([status, count]) => (
                <button
                  key={status}
                  className={`my-day-focus-status-chip ${filterMode === status ? "active" : ""}`}
                  onClick={() => setFilterMode(status)}
                >
                  {statusLabel(status)} ({count})
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
          <button className="btn-secondary" onClick={onExit}>{t("cancel")}</button>
          <button className="btn-primary" onClick={() => setPhase("working")} disabled={currentCount === 0}>
            {t("focusBegin")}
          </button>
        </div>
      </div>
    );
  }

  const handleExit = () => {
    stopCallTimer();
    const totalActions = sessionStats.done + sessionStats.snoozed + sessionStats.fullFollowups;
    if (totalActions > 0) setPhase("summary");
    else onExit();
  };

  if (phase === "summary") {
    return (
      <div className="my-day-focus-empty">
        <PartyPopper size={40} />
        <h3>{t("focusSessionSummaryTitle")}</h3>
        <div className="my-day-briefing-stats" style={{ maxWidth: 360, margin: "16px auto" }}>
          <div className="my-day-briefing-stat">
            <div className="my-day-briefing-stat-value">{sessionStats.done + sessionStats.fullFollowups}</div>
            <div className="my-day-briefing-stat-label">{t("doneLabel")}</div>
          </div>
          <div className="my-day-briefing-stat">
            <div className="my-day-briefing-stat-value">{sessionStats.snoozed}</div>
            <div className="my-day-briefing-stat-label">{t("snoozedLabel")}</div>
          </div>
          <div className="my-day-briefing-stat">
            <div className="my-day-briefing-stat-value">{sessionStats.skipped}</div>
            <div className="my-day-briefing-stat-label">{t("focusSkip")}</div>
          </div>
        </div>
        <button className="btn-primary" onClick={onExit}>{t("exitFocusMode")}</button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="my-day-focus-empty">
        <Check size={40} />
        <h3>{t("focusAllDoneTitle")}</h3>
        <p>{t("focusAllDoneHint")}</p>
        <button className="btn-primary" onClick={handleExit}>{t("exitFocusMode")}</button>
      </div>
    );
  }

  // Skip any that got done while browsing back and forth, landing on the
  // next real thing to do rather than an already-finished card.
  let safeIndex = index;
  if (safeIndex >= total) safeIndex = total - 1;
  const c = workingQueue[safeIndex];

  const jumpMatches = jumpSearch.trim()
    ? workingQueue.filter((q) => q.name?.toLowerCase().includes(jumpSearch.trim().toLowerCase())).slice(0, 6)
    : [];

  const jumpTo = (partnerId) => {
    const i = workingQueue.findIndex((q) => q.partner_id === partnerId);
    if (i >= 0) setIndex(i);
    setJumpSearch("");
    stopCallTimer();
  };

  const goNext = () => {
    stopCallTimer();
    if (safeIndex < total - 1) setIndex(safeIndex + 1);
    else handleExit();
  };
  const goPrev = () => { stopCallTimer(); if (safeIndex > 0) setIndex(safeIndex - 1); };

  const handleSkip = () => {
    setSessionStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    goNext();
  };

  // Logs the action immediately, then holds on the current card for a
  // moment with a visible "moving on" state before advancing - a beat to
  // notice what just happened rather than the screen instantly changing
  // out from under you.
  const handleAction = async (action, statKey) => {
    await action();
    if (statKey) setSessionStats((s) => ({ ...s, [statKey]: s[statKey] + 1 }));
    setAdvancing(true);
    setTimeout(() => {
      setAdvancing(false);
      goNext();
    }, 2000);
  };

  return (
    <div className="my-day-focus-wrap">
      <div className="my-day-focus-header">
        <button className="btn-secondary sm" onClick={handleExit}>
          <List size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
          {t("exitFocusMode")}
        </button>
        <div className="my-day-focus-progress-label">{safeIndex + 1} / {total} · {doneCount} {t("doneLabel")}</div>
      </div>
      <div className="my-day-progress-track" style={{ marginBottom: 14 }}>
        <div className="my-day-progress-fill" style={{ width: `${Math.round(((safeIndex + 1) / total) * 100)}%` }} />
      </div>

      <div className="my-day-focus-jump-wrap">
        <input
          className="my-day-search-input"
          placeholder={t("focusJumpPlaceholder")}
          value={jumpSearch}
          onChange={(e) => setJumpSearch(e.target.value)}
        />
        {jumpMatches.length > 0 && (
          <div className="my-day-focus-jump-results">
            {jumpMatches.map((q) => (
              <button key={q.partner_id} className="my-day-focus-jump-option" onClick={() => jumpTo(q.partner_id)}>
                {q.name} {q.done_today && <span className="my-day-focus-jump-done">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {advancing ? (
        <div className="my-day-focus-advancing">
          <Check size={32} />
          <p>{t("focusMovingOn")}</p>
        </div>
      ) : (
        <>
          <div className={`my-day-focus-card ${c.done_today ? "done" : ""}`}>
            {c.carried_forward && (
              <div className="my-day-focus-flag danger"><AlertTriangle size={13} /> {t("myDayOverdueBy").replace("{n}", c.days_overdue)}</div>
            )}
            {c.carried_forward && <div><SlaTimerBadge dueDateStr={c.next_follow_up_date} nowMs={nowMs} t={t} /></div>}
            {!c.carried_forward && c.due_today && (
              <div className="my-day-focus-flag warn">{t("myDayDueToday")}</div>
            )}
            {c.done_today && <div className="my-day-focus-flag ok"><Check size={13} /> {t("doneTodayLabel")}</div>}

            <h2 className="my-day-focus-name">{c.name} <RiskBadge level={c.risk_level} /></h2>
            {c.city && <div className="my-day-city">{c.city}</div>}

            <div className="my-day-focus-stats">
              <div><span className="my-day-focus-stat-label">{t("balanceDue")}</span><strong><RiyalAmount amount={c.current_due} /></strong></div>
              {c.overdue_amount > 0 && (
                <div><span className="my-day-focus-stat-label">{t("overdueAmount")}</span><strong className="my-day-overdue-amount"><RiyalAmount amount={c.overdue_amount} /></strong></div>
              )}
              <div><span className="my-day-focus-stat-label">{t("status")}</span><span className="fu-tag sm">{statusLabel(c.follow_up_status)}</span></div>
            </div>

            {c.last_activity && (
              <div className="my-day-focus-last-activity">
                <strong>{statusLabel(c.last_activity.status)}</strong>{c.last_activity.note ? ` — ${c.last_activity.note}` : ""}
                <div className="my-day-city">{c.last_activity.username} · {fmtDateTime(c.last_activity.created_at)}</div>
              </div>
            )}
            {c.best_call_hour !== null && c.best_call_hour !== undefined && (
              <div className="my-day-best-time"><Lightbulb size={11} /> {t("bestTimeToCall")}: {formatHour(c.best_call_hour)}</div>
            )}

            <ComplianceChecklist t={t} />

            <div className="my-day-focus-contact-row">
              {c.phone && (
                <a className="btn-secondary sm" href={`tel:${c.phone}`} onClick={startCallTimer}>
                  <Phone size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("call")}
                </a>
              )}
              {c.phone && <a className="btn-secondary sm" href={waLink(c.phone)} target="_blank" rel="noreferrer"><MessageCircle size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />WhatsApp</a>}
              <button className="btn-secondary sm" onClick={() => onSelectCustomer?.(c.partner_id)}>{t("viewDetails")}</button>
            </div>

            {callRunning && (
              <div className="my-day-call-timer">
                <Timer size={13} />
                {String(Math.floor(callSeconds / 60)).padStart(2, "0")}:{String(callSeconds % 60).padStart(2, "0")}
                <button className="my-day-call-timer-stop" onClick={stopCallTimer}>{t("stopTimer")}</button>
              </div>
            )}

            {c.done_today ? (
              <div className="my-day-focus-outcomes">
                <button className="btn-secondary sm" onClick={() => onUndo(c.partner_id)}>
                  {t("undoDoneButton")}
                </button>
              </div>
            ) : (
              <div className="my-day-focus-outcomes">
                {quickStatuses.map((qs) => (
                  <button key={qs.id} className="btn-primary sm" onClick={() => setQuickOutcomeStatus(qs)}>
                    {statusLabel(qs.name)}
                  </button>
                ))}
                <button className="btn-secondary sm" onClick={() => handleAction(() => onQuickCheckin(c.partner_id), "done")}>
                  <Check size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("doneLabel")}
                </button>
                <button className="btn-secondary sm" onClick={() => handleAction(() => onSnooze(c.partner_id, 2), "snoozed")}>
                  <Clock size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("snooze2h")}
                </button>
                <button className="btn-secondary sm" onClick={() => setShowFullForm(true)}>
                  <ClipboardList size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("fullFollowupButton")}
                </button>
              </div>
            )}
          </div>

          <div className="my-day-focus-nav">
            <button className="btn-secondary" onClick={goPrev} disabled={safeIndex === 0}>
              <ArrowLeft size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("focusPrevious")}
            </button>
            <button className="btn-secondary" onClick={handleSkip}>
              {t("focusSkip")}<SkipForward size={14} style={{ verticalAlign: -2, marginInlineStart: 5 }} />
            </button>
          </div>
        </>
      )}

      {showFullForm && (
        <FullFollowupModal
          customer={c} statuses={statuses} t={t} statusLabel={statusLabel}
          onClose={() => setShowFullForm(false)}
          onSubmit={async (payload) => {
            setShowFullForm(false);
            await handleAction(() => onFullFollowup(c.partner_id, payload), "fullFollowups");
          }}
        />
      )}
      {quickOutcomeStatus && (
        <QuickOutcomeModal
          customerName={c.name} status={quickOutcomeStatus} statusLabel={statusLabel} t={t}
          onClose={() => setQuickOutcomeStatus(null)}
          onSubmit={async (note, nextDate) => {
            const status = quickOutcomeStatus;
            setQuickOutcomeStatus(null);
            await handleAction(() => onQuickOutcome(c.partner_id, status.name, note, nextDate), "done");
          }}
        />
      )}
    </div>
  );
}

function FullFollowupModal({ customer, statuses, onClose, onSubmit, t, statusLabel }) {
  const [status, setStatus] = useState(customer.follow_up_status || "");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const cfg = statuses.find((s) => s.name === status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        status, note: note.trim() || null,
        amount: cfg?.requires_payment_details && amount ? parseFloat(amount) : null,
        payment_mode: cfg?.requires_payment_details ? paymentMode || null : null,
        next_follow_up_date: nextDate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{customer.name}</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          <label>{t("status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} required>
            <option value="">{t("selectOption")}</option>
            {statuses.map((s) => <option key={s.id} value={s.name}>{statusLabel(s.name)}</option>)}
          </select>
          <label>{t("note")}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          {cfg?.requires_payment_details && (
            <>
              <label>{t("amountPaid")}</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <label>{t("paymentMode")}</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="">{t("selectOption")}</option>
                <option value="Cash">{t("paymentModeCash")}</option>
                <option value="Bank Transfer">{t("paymentModeBankTransfer")}</option>
                <option value="Cheque">{t("paymentModeCheque")}</option>
                <option value="Online">{t("paymentModeOnline")}</option>
              </select>
            </>
          )}
          <label>{t("nextFollowupDate")}</label>
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-primary" type="submit" disabled={saving || !status}>
              {saving ? t("saving") : t("logFollowup")}
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>{t("cancel")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickOutcomeModal({ customerName, status, statusLabel, onClose, onSubmit, t }) {
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(note.trim(), status.requires_next_date ? nextDate : null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{customerName}</h3>
        <p className="panel-sub">{statusLabel(status.name)}</p>
        <form onSubmit={handleSubmit} className="admin-form">
          <label>{t("note")}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required autoFocus />
          {status.requires_next_date && (
            <>
              <label>{t("nextFollowupDate")}</label>
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required />
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-primary" type="submit" disabled={saving || !note.trim() || (status.requires_next_date && !nextDate)}>
              {saving ? t("saving") : t("logFollowup")}
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>{t("cancel")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

function formatHour(hour) {
  if (hour === null || hour === undefined) return null;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function OutcomeDetailModal({ status, items, onClose, t, statusLabel, onSelectCustomer }) {
  const matches = items.filter((c) => c.last_activity && c.last_activity.status === status && c.done_today);
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 480, maxHeight: "75vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{statusLabel(status)} ({matches.length})</h3>
        {matches.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
        {matches.length > 0 && (
          <div className="fu-history">
            {matches.map((c) => (
              <div key={c.partner_id} className="fu-entry clickable-row" onClick={() => { onSelectCustomer?.(c.partner_id); onClose(); }}>
                <div className="fu-entry-top">
                  <span className="fu-tag sm">{statusLabel(c.follow_up_status)}</span>
                  <span className="fu-entry-meta">{fmtDateTime(c.last_activity.created_at)}</span>
                </div>
                <div className="fu-entry-note"><strong>{c.name}</strong> — <RiyalAmount amount={c.current_due} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MorningBriefingModal({ summary, onClose, t }) {
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal my-day-briefing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <div className="my-day-briefing-icon"><Sun size={26} /></div>
        <h3>{t("goodMorningTitle")}</h3>
        <p className="prompt-message">{t("morningBriefingHint")}</p>
        <div className="my-day-briefing-stats">
          <div className="my-day-briefing-stat">
            <div className="my-day-briefing-stat-value">{summary.queue_count}</div>
            <div className="my-day-briefing-stat-label">{t("totalCustomersLabel")}</div>
          </div>
          <div className="my-day-briefing-stat danger">
            <div className="my-day-briefing-stat-value">{summary.carried_forward_count}</div>
            <div className="my-day-briefing-stat-label">{t("carriedForwardLabel")}</div>
          </div>
          <div className="my-day-briefing-stat">
            <div className="my-day-briefing-stat-value">{summary.due_today_count}</div>
            <div className="my-day-briefing-stat-label">{t("myDayDueToday")}</div>
          </div>
        </div>
        {summary.streak > 0 && (
          <div className="my-day-briefing-streak">🔥 {t("streakContinueMsg").replace("{n}", summary.streak)}</div>
        )}
        <button className="btn-primary my-day-briefing-close-btn" onClick={onClose}>{t("letsGo")}</button>
      </div>
    </div>
  );
}

function HistoryModal({ customer, onClose }) {
  const { t, statusLabel } = useLang();
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    api.customerActivity(customer.partner_id, { page_size: 100 }).then(setActivity).catch(() => setActivity({ results: [] }));
  }, [customer.partner_id]);

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 520, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3><ClipboardList size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{customer.name}</h3>
        <p className="panel-sub">{t("activityTimelineTitle")}</p>

        {!activity && <div className="loading-state">{t("loadingDots")}</div>}
        {activity && activity.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
        {activity && activity.results.length > 0 && (
          <div className="activity-timeline">
            {activity.results.map((ev, i) => (
              <div key={i} className={`activity-item activity-${ev.type}`}>
                <div className="activity-dot" />
                <div className="activity-body">
                  <div className="activity-title">
                    {ev.type === "invoice" && <><Receipt size={12} /> {t("activityInvoice")}: {ev.title}</>}
                    {ev.type === "credit_note" && <><Receipt size={12} /> {t("activityCreditNote")}: {ev.title}</>}
                    {ev.type === "payment" && <><Wallet size={12} /> {t("paymentReceivedLabel")}: {ev.title}</>}
                    {ev.type === "followup" && <><ClipboardList size={12} /> {statusLabel(ev.title)}</>}
                  </div>
                  <div className="activity-meta">
                    {fmtDateTime(ev.date)}
                    {ev.type === "followup" && ev.username && ` · ${ev.username}`}
                    {(ev.type === "invoice" || ev.type === "credit_note" || ev.type === "payment") && ev.amount ? (
                      <> · <RiyalAmount amount={ev.amount} /></>
                    ) : null}
                  </div>
                  {ev.note && <div className="activity-note">{ev.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SnoozeMenu({ partnerId, onSnooze }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const options = [
    { hours: 1, label: t("snooze1h") },
    { hours: 2, label: t("snooze2h") },
    { hours: 4, label: t("snooze4h") },
    { hours: 24, label: t("snoozeTomorrow") },
  ];

  return (
    <div className="my-day-snooze-wrap">
      <button className="icon-btn" title={t("snoozeTitle")} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <Clock size={14} />
      </button>
      {open && (
        <>
          <div className="my-day-snooze-backdrop" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="my-day-snooze-menu" onClick={(e) => e.stopPropagation()}>
            {options.map((o) => (
              <button key={o.hours} className="my-day-snooze-option" onClick={() => { onSnooze(partnerId, o.hours); setOpen(false); }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerRow({ c, t, statusLabel, onQuickCheckin, onUndo, onOpenHistory, onSelectCustomer, onSnooze, quickStatuses, onQuickOutcome, nowMs, onOpenSettlement }) {
  return (
    <tr className={c.done_today ? "my-day-row-done" : ""}>
      <td data-label="">
        <input
          type="checkbox"
          className="my-day-checkbox"
          checked={!!c.done_today}
          onChange={() => (c.done_today ? onUndo(c.partner_id) : onQuickCheckin(c.partner_id))}
          title={c.done_today ? t("undoDoneButton") : t("quickCheckinTitle")}
        />
      </td>
      <td data-label={t("customer")}>
        <span className="cust-name">{c.name}</span> <RiskBadge level={c.risk_level} />
        {c.city && <div className="my-day-city">{c.city}</div>}
        {c.done_today && <span className="my-day-done-badge">✓ {t("doneTodayLabel")}</span>}
      </td>
      <td data-label={t("phone")}>{c.phone || "—"}</td>
      <td data-label={t("dueLabel")}>
        <span className={`my-day-due-badge ${c.days_overdue > 0 ? "overdue" : "today"}`}>
          {c.days_overdue > 0 ? t("myDayOverdueBy").replace("{n}", c.days_overdue) : t("myDayDueToday")}
        </span>
        <div className="my-day-city">{fmtDate(c.next_follow_up_date)}</div>
        {c.carried_forward && <SlaTimerBadge dueDateStr={c.next_follow_up_date} nowMs={nowMs} t={t} />}
      </td>
      <td data-label={t("status")}>
        <span className="fu-tag sm">{statusLabel(c.follow_up_status)}</span>
        {!c.done_today && quickStatuses && quickStatuses.length > 0 && (
          <div className="my-day-quick-outcomes">
            {quickStatuses.map((s) => (
              <button key={s.id} className="my-day-quick-outcome-btn" onClick={() => onQuickOutcome(c.partner_id, s.name)}>
                {statusLabel(s.name)}
              </button>
            ))}
          </div>
        )}
      </td>
      <td data-label={t("lastActivityLabel")}>
        {c.last_activity ? (
          <div className="my-day-activity-cell clickable-row" onClick={() => onOpenHistory({ partner_id: c.partner_id, name: c.name })}>
            <div><strong>{statusLabel(c.last_activity.status)}</strong>{c.last_activity.note ? ` — ${c.last_activity.note}` : ""}</div>
            <div className="my-day-city">{c.last_activity.username} · {fmtDateTime(c.last_activity.created_at)} · <span className="my-day-view-history-link">{t("viewFullHistory")}</span></div>
          </div>
        ) : "—"}
        {c.best_call_hour !== null && c.best_call_hour !== undefined && (
          <div className="my-day-best-time"><Lightbulb size={11} /> {t("bestTimeToCall")}: {formatHour(c.best_call_hour)}</div>
        )}
      </td>
      <td data-label={t("balanceDue")}><strong><RiyalAmount amount={c.current_due} /></strong></td>
      <td data-label={t("overdueAmount")}>
        {c.overdue_amount > 0 ? <span className="my-day-overdue-amount"><RiyalAmount amount={c.overdue_amount} /></span> : "—"}
      </td>
      <td data-label={t("totalPaidLabel")}>{c.total_paid ? <RiyalAmount amount={c.total_paid} /> : "—"}</td>
      <td data-label={t("actionsLabel")}>
        <div style={{ display: "flex", gap: 6 }}>
          {c.phone && (
            <a className="icon-btn call-icon-btn" href={`tel:${c.phone}`} title={t("call")}>
              <Phone size={14} />
            </a>
          )}
          {c.phone && (
            <a className="icon-btn call-icon-btn" href={waLink(c.phone)} target="_blank" rel="noreferrer" title="WhatsApp">
              <MessageCircle size={14} />
            </a>
          )}
          <button className="icon-btn" title={t("viewDetails")} onClick={() => onSelectCustomer?.(c.partner_id)}>
            <ChevronRight size={14} />
          </button>
          <button className="icon-btn" title={t("calculatorTitle")} onClick={() => onOpenSettlement(c)}>
            <Calculator size={14} />
          </button>
          <SnoozeMenu partnerId={c.partner_id} onSnooze={onSnooze} />
        </div>
      </td>
    </tr>
  );
}

function QueueTable({ items, t, statusLabel, onQuickCheckin, onUndo, onOpenHistory, onSelectCustomer, onSnooze, quickStatuses, onQuickOutcome, nowMs, onOpenSettlement }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            <th>{t("customer")}</th>
            <th>{t("phone")}</th>
            <th>{t("dueLabel")}</th>
            <th>{t("status")}</th>
            <th>{t("lastActivityLabel")}</th>
            <th>{t("balanceDue")}</th>
            <th>{t("overdueAmount")}</th>
            <th>{t("totalPaidLabel")}</th>
            <th>{t("actionsLabel")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <CustomerRow
              key={c.partner_id} c={c} t={t} statusLabel={statusLabel}
              onQuickCheckin={onQuickCheckin} onUndo={onUndo} onOpenHistory={onOpenHistory} onSelectCustomer={onSelectCustomer} onSnooze={onSnooze}
              quickStatuses={quickStatuses} onQuickOutcome={onQuickOutcome} nowMs={nowMs} onOpenSettlement={onOpenSettlement}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MyDay({ onSelectCustomer }) {
  const { t, statusLabel, money, lang } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [sortMode, setSortMode] = useState("default");
  const [search, setSearch] = useState("");
  const [groupByCity, setGroupByCity] = useState(false);
  const [showNotDueYet, setShowNotDueYet] = useState(false);
  const [outcomeModalStatus, setOutcomeModalStatus] = useState(null);
  const carriedForwardRef = useRef(null);
  const todaysQueueRef = useRef(null);
  const notDueYetRef = useRef(null);

  const scrollToSection = (ref, expandNotDue) => {
    if (expandNotDue) setShowNotDueYet(true);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), expandNotDue ? 50 : 0);
  };

  const scrollToFirstSection = () => {
    const ref = carriedForwardRef.current ? carriedForwardRef : todaysQueueRef.current ? todaysQueueRef : notDueYetRef;
    scrollToSection(ref, ref === notDueYetRef);
  };
  const [attendance, setAttendance] = useState(null);
  const [clockBusy, setClockBusy] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [settlementCustomer, setSettlementCustomer] = useState(null);

  useEffect(() => {
    // Drives the SLA urgency timers - one shared tick for the whole page
    // instead of a setInterval per row.
    const tick = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);
  const [showInsights, setShowInsights] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    api.myDay().then((d) => {
      setData(d);
      const todayKey = `myday-briefing-${d.date}`;
      if (!localStorage.getItem(todayKey)) {
        setShowBriefing(true);
        localStorage.setItem(todayKey, "1");
      }
    }).catch((e) => setError(e.message));
    api.followupStatuses().then(setStatuses).catch(() => {});
    api.attendanceToday().then(setAttendance).catch(() => {});
  }, []);

  const handleClockIn = async () => {
    setClockBusy(true);
    try {
      const r = await api.clockIn();
      setAttendance({ clock_in: r.clock_in, clock_out: null });
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setClockBusy(false);
    }
  };

  const handleClockOut = async () => {
    setClockBusy(true);
    try {
      const r = await api.clockOut();
      setAttendance((prev) => ({ ...prev, clock_out: r.clock_out }));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setClockBusy(false);
    }
  };

  // Top 3 statuses that don't need extra details (amount/payment mode) - the
  // point of a quick-outcome button is one tap, not opening another form.
  const quickStatuses = statuses.filter((s) => !s.requires_payment_details && s.name !== "Not Contacted").slice(0, 3);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await api.myPerformancePdf(lang);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleQuickCheckin = async (partnerId) => {
    // Optimistic update first - the checkbox should feel instant, not wait
    // on a round trip before it visibly ticks.
    setData((prev) => {
      if (!prev) return prev;
      const alreadyDone = prev.items.find((i) => i.partner_id === partnerId)?.done_today;
      if (alreadyDone) return prev;
      return {
        ...prev,
        summary: prev.summary ? {
          ...prev.summary,
          completed_today: prev.summary.completed_today + 1,
          pending_count: Math.max(0, prev.summary.pending_count - 1),
        } : prev.summary,
        items: prev.items.map((i) => (i.partner_id === partnerId ? { ...i, done_today: true } : i)),
      };
    });
    try {
      await api.quickCheckin(partnerId);
    } catch (e) {
      showToast(e.message, "error");
      api.myDay().then(setData).catch(() => {});
    }
  };

  // Every follow-up log requires a note (and, for some statuses, a next
  // date) server-side - a quick-outcome tap can't skip straight to the API
  // like quick check-in does, so it opens a one-field modal to collect just
  // that before submitting.
  const submitQuickOutcome = async (partnerId, status, note, nextFollowUpDate) => {
    setData((prev) => {
      if (!prev) return prev;
      const alreadyDone = prev.items.find((i) => i.partner_id === partnerId)?.done_today;
      return {
        ...prev,
        summary: prev.summary && !alreadyDone ? { ...prev.summary, completed_today: prev.summary.completed_today + 1, pending_count: Math.max(0, prev.summary.pending_count - 1) } : prev.summary,
        items: prev.items.map((i) => (i.partner_id === partnerId ? { ...i, done_today: true, follow_up_status: status } : i)),
      };
    });
    try {
      await api.logFollowup(partnerId, { status, note, next_follow_up_date: nextFollowUpDate || null });
      showToast(t("outcomeLogged"), "success");
      api.myDay().then(setData).catch(() => {});
    } catch (e) {
      showToast(e.message, "error");
      api.myDay().then(setData).catch(() => {});
    }
  };

  const [quickOutcomeRequest, setQuickOutcomeRequest] = useState(null); // { partnerId, name, status }
  const requestQuickOutcome = (partnerId, statusName) => {
    const statusObj = statuses.find((s) => s.name === statusName) || { name: statusName, requires_next_date: false };
    const customer = items.find((i) => i.partner_id === partnerId);
    setQuickOutcomeRequest({ partnerId, name: customer?.name || "", status: statusObj });
  };

  const handleSnooze = async (partnerId, hours) => {
    // Optimistic: remove it from the visible list immediately and bump the
    // snoozed counter, so the person sees it vanish right away instead of
    // waiting on the round trip.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        summary: prev.summary ? { ...prev.summary, snoozed_count: (prev.summary.snoozed_count || 0) + 1 } : prev.summary,
        items: prev.items.filter((i) => i.partner_id !== partnerId),
      };
    });
    try {
      await api.snoozeCustomer(partnerId, hours);
      showToast(t("snoozedToast"), "success");
    } catch (e) {
      showToast(e.message, "error");
      api.myDay().then(setData).catch(() => {});
    }
  };

  const handleUndo = async (partnerId) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        summary: prev.summary ? {
          ...prev.summary,
          completed_today: Math.max(0, prev.summary.completed_today - 1),
          pending_count: prev.summary.pending_count + 1,
        } : prev.summary,
        items: prev.items.map((i) => (i.partner_id === partnerId ? { ...i, done_today: false } : i)),
      };
    });
    try {
      await api.undoTodayCheckin(partnerId);
      showToast(t("undoneToast"), "success");
    } catch (e) {
      showToast(e.message, "error");
      api.myDay().then(setData).catch(() => {});
    }
  };

  const handleFullFollowup = async (partnerId, payload) => {
    setData((prev) => {
      if (!prev) return prev;
      const alreadyDone = prev.items.find((i) => i.partner_id === partnerId)?.done_today;
      return {
        ...prev,
        summary: prev.summary && !alreadyDone ? { ...prev.summary, completed_today: prev.summary.completed_today + 1, pending_count: Math.max(0, prev.summary.pending_count - 1) } : prev.summary,
        items: prev.items.map((i) => (i.partner_id === partnerId ? { ...i, done_today: true, follow_up_status: payload.status } : i)),
      };
    });
    try {
      await api.logFollowup(partnerId, payload);
      showToast(t("outcomeLogged"), "success");
      api.myDay().then(setData).catch(() => {});
    } catch (e) {
      showToast(e.message, "error");
      api.myDay().then(setData).catch(() => {});
    }
  };

  const items = data?.items || [];
  const summary = data?.summary;
  const overdueTotal = items.reduce((s, c) => s + (c.overdue_amount || 0), 0);
  const paymentDiff = summary ? summary.collected_today - summary.collected_yesterday : 0;

  const sortItems = (arr) => {
    const copy = [...arr];
    if (sortMode === "balance") copy.sort((a, b) => (b.current_due || 0) - (a.current_due || 0));
    else if (sortMode === "overdue_days") copy.sort((a, b) => b.days_overdue - a.days_overdue);
    return copy;
  };

  const searchLower = search.trim().toLowerCase();
  const filteredItems = searchLower
    ? items.filter((c) => c.name?.toLowerCase().includes(searchLower) || c.city?.toLowerCase().includes(searchLower))
    : items;

  const carriedForward = sortItems(filteredItems.filter((c) => c.carried_forward));
  const todaysQueue = sortItems(filteredItems.filter((c) => c.due_today));
  const notDueYet = sortItems(filteredItems.filter((c) => c.not_due_yet));
  const dueQueue = [...carriedForward, ...todaysQueue];

  // Focus Mode's own order: a customer who owes nothing (or is in credit)
  // isn't a collections priority no matter how overdue or neglected they
  // are, so they're dropped from Focus Mode entirely. Among the rest,
  // balance is weighted as the dominant signal, with staleness (longest
  // overdue) and neglect (longest since last contact) breaking ties -
  // ranked, not raw-value, so the three signals weigh in evenly on their
  // own scale before balance is doubled.
  const focusQueue = (() => {
    const eligible = dueQueue.filter((c) => (c.current_due || 0) > 0);
    if (eligible.length === 0) return eligible;
    const neglectDays = (c) => (
      c.last_activity?.created_at ? (nowMs - new Date(c.last_activity.created_at).getTime()) / 86400000 : Infinity
    );
    const rankBy = (keyFn) => {
      const sorted = [...eligible].sort((a, b) => keyFn(b) - keyFn(a));
      const ranks = new Map();
      sorted.forEach((c, i) => ranks.set(c.partner_id, i));
      return ranks;
    };
    const overdueRank = rankBy((c) => c.days_overdue || 0);
    const balanceRank = rankBy((c) => c.current_due || 0);
    const neglectRank = rankBy(neglectDays);
    return [...eligible].sort((a, b) => {
      const scoreA = overdueRank.get(a.partner_id) + balanceRank.get(a.partner_id) * 2 + neglectRank.get(a.partner_id);
      const scoreB = overdueRank.get(b.partner_id) + balanceRank.get(b.partner_id) * 2 + neglectRank.get(b.partner_id);
      return scoreA - scoreB;
    });
  })();

  // City groups for the "group by city" view - one QueueTable per city,
  // sorted by group size (largest first) so the most efficient route to
  // work today shows up on top.
  const groupByCityFn = (arr) => {
    const groups = {};
    arr.forEach((c) => {
      const key = c.city || t("unassigned");
      (groups[key] = groups[key] || []).push(c);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  // After mid-afternoon, if there's still real work left, a quiet reminder
  // beats silently letting the day run out - matches how a shift supervisor
  // would nudge the team before close.
  const currentHour = new Date().getHours();
  const showEndOfDayReminder = currentHour >= 15 && summary && summary.pending_count > 0;
  const isEarlyInDay = currentHour < 12;


  const statusChartData = Object.entries(
    items.reduce((acc, c) => {
      const key = c.follow_up_status || "—";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status: statusLabel(status), count }));

  // How overdue the list is, bucketed - a different cut than the status
  // donut, so the two charts complement rather than repeat each other.
  const agingBuckets = [
    { key: "today", label: t("myDayDueToday"), test: (d) => d === 0 },
    { key: "1-7", label: "1-7d", test: (d) => d >= 1 && d <= 7 },
    { key: "8-30", label: "8-30d", test: (d) => d >= 8 && d <= 30 },
    { key: "30+", label: "30d+", test: (d) => d > 30 },
  ];
  const agingChartData = agingBuckets.map((b) => ({
    label: b.label,
    amount: items.filter((c) => b.test(c.days_overdue)).reduce((s, c) => s + (c.overdue_amount || c.current_due || 0), 0),
  }));

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2>
              <Sun size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("myDayTitle")}
              {summary?.streak > 0 && <span className="my-day-streak-badge">🔥 {summary.streak} {t("streakDaysLabel")}</span>}
            </h2>
            <p className="panel-sub">{t("myDayHint")}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {attendance && !attendance.clock_in && (
              <button className="btn-secondary sm" onClick={handleClockIn} disabled={clockBusy}>
                <LogIn size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("clockIn")}
              </button>
            )}
            {attendance && attendance.clock_in && !attendance.clock_out && (
              <button className="btn-secondary sm" onClick={handleClockOut} disabled={clockBusy}>
                <LogOut size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("clockOut")}
              </button>
            )}
            {attendance && attendance.clock_in && attendance.clock_out && (
              <span className="my-day-clocked-out-note">{t("clockedOutNote")}</span>
            )}
            {!focusMode && focusQueue.length > 0 && (
              <button className="btn-primary sm" onClick={() => setFocusMode(true)}>
                <PlayCircle size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("startFocusMode")}
              </button>
            )}
            <button className="btn-secondary sm" onClick={handleDownloadPdf} disabled={downloadingPdf}>
              <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {downloadingPdf ? t("exporting") : t("downloadPdfReport")}
            </button>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && items.length === 0 && <div className="empty-state">{t("myDayEmpty")}</div>}

        {focusMode && (
          <FocusModeView
            queue={focusQueue} quickStatuses={quickStatuses} statuses={statuses}
            onQuickOutcome={submitQuickOutcome} onQuickCheckin={handleQuickCheckin} onUndo={handleUndo}
            onSnooze={handleSnooze} onFullFollowup={handleFullFollowup}
            onSelectCustomer={onSelectCustomer} onExit={() => setFocusMode(false)}
            t={t} statusLabel={statusLabel} money={money} nowMs={nowMs}
          />
        )}

        {!focusMode && showEndOfDayReminder && (
          <div className="my-day-eod-reminder">
            <AlertTriangle size={14} />
            {t("endOfDayReminder").replace("{n}", summary.pending_count)}
          </div>
        )}

        {!focusMode && data && items.length > 0 && (
          <div className="my-day-toolbar">
            <input
              className="my-day-search-input"
              placeholder={t("myDaySearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={`my-day-group-toggle ${groupByCity ? "active" : ""}`} onClick={() => setGroupByCity((v) => !v)}>
              {t("groupByCityLabel")}
            </button>
          </div>
        )}

        {!focusMode && data && items.length > 0 && (
          <>
            {summary && summary.queue_count === 0 && (
              <div className="my-day-nothing-due-banner">
                <PartyPopper size={16} />
                {t("nothingDueTodayMsg")}
              </div>
            )}

            {summary && summary.queue_count > 0 && (
              <div className="my-day-progress-strip">
                <div className="my-day-progress-item">
                  <span className="my-day-progress-label">{t("todayProgressLabel")}</span>
                  <span className="my-day-progress-value">
                    <strong className="ok">{summary.completed_today}</strong> / {summary.queue_count} {t("doneLabel")}
                    {summary.pending_count > 0 && <span className="my-day-progress-pending"> · {summary.pending_count} {t("stillPendingLabel")}</span>}
                  </span>
                  <div className="my-day-progress-track">
                    <div className="my-day-progress-fill" style={{ width: `${summary.queue_count ? Math.round((summary.completed_today / summary.queue_count) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            )}

            {summary && (
              <div className="my-day-progress-strip">
                <div className="my-day-progress-item">
                  <span className="my-day-progress-label">{t("todayVsYesterdayLabel")}</span>
                  <span className="my-day-progress-value">
                    {money(summary.collected_today)} <span className="my-day-city">{t("vsLabel")} {money(summary.collected_yesterday)} {t("yesterdayLabel")}</span>
                    {paymentDiff !== 0 && (
                      <span className={paymentDiff > 0 ? "my-day-diff-up" : "my-day-diff-down"}>
                        {paymentDiff > 0 ? " ▲ " : " ▼ "}{money(Math.abs(paymentDiff))}
                      </span>
                    )}
                  </span>
                  {isEarlyInDay && summary.collected_today === 0 && summary.collected_yesterday > 0 && (
                    <div className="my-day-early-day-note">{t("earlyInDayNote")}</div>
                  )}
                </div>
              </div>
            )}

            {summary && (summary.monthly_target || summary.historical_comparison || summary.daily_target) && (
              <div className="my-day-secondary-cards">
                <DailyTargetCard dailyTarget={summary.daily_target} t={t} money={money} />
                <TargetGaugeCard monthlyTarget={summary.monthly_target} collectedThisMonth={summary.collected_this_month} t={t} money={money} />
                <HistoricalComparisonCard
                  comparison={summary.historical_comparison} collectedToday={summary.collected_today}
                  completedToday={summary.completed_today} t={t} money={money}
                />
              </div>
            )}

            <button className="my-day-insights-toggle" onClick={() => setShowInsights((v) => !v)}>
              {showInsights ? t("hideInsights") : t("showInsights")}
              <ChevronRight size={13} className={showInsights ? "my-day-chevron-open" : ""} />
            </button>

            {showInsights && (
              <>
                {summary && summary.today_outcomes && summary.today_outcomes.length > 0 && (
                  <div className="my-day-outcomes-card">
                    <div className="my-day-outcomes-title">{t("todayOutcomesTitle")}</div>
                    <div className="my-day-outcomes-chips">
                      {summary.today_outcomes.map((o) => (
                        <span key={o.status} className="my-day-outcome-chip clickable-row" onClick={() => setOutcomeModalStatus(o.status)}>
                          {statusLabel(o.status)}: <strong>{o.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
                  <div className="insights-kpi-card accent-violet clickable-row" onClick={scrollToFirstSection}>
                    <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("totalCustomersLabel")}</div>
                    </div>
                    <div className="insights-kpi-value">{items.length}</div>
                  </div>
                  <div className="insights-kpi-card accent-amber clickable-row" onClick={() => scrollToSection(todaysQueueRef, false)}>
                    <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("myDayDueToday")}</div>
                    </div>
                    <div className="insights-kpi-value">{todaysQueue.length}</div>
                  </div>
                  <div className="insights-kpi-card accent-danger clickable-row" onClick={() => scrollToSection(carriedForwardRef, false)}>
                    <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("carriedForwardLabel")}</div>
                    </div>
                    <div className="insights-kpi-value">{carriedForward.length}</div>
                  </div>
                  <div className="insights-kpi-card accent-teal clickable-row" onClick={() => scrollToSection(carriedForwardRef, false)}>
                    <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("overdueAmount")}</div>
                    </div>
                    <div className="insights-kpi-value">{money(overdueTotal)}</div>
                  </div>
                </div>

                <div className="insights-charts-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {statusChartData.length > 1 && (
                    <div className="insights-chart-card">
                      <h3 className="insights-chart-title">{t("myDayChartTitle")}</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={statusChartData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {statusChartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="insights-chart-card">
                    <h3 className="insights-chart-title">{t("myDayAgingChartTitle")}</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={agingChartData}>
                        <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                               tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                        <Bar dataKey="amount" name={t("overdueAmount")} fill="#D6145F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {carriedForward.length > 0 && (
              <>
                <div className="my-day-section-header carried-forward" ref={carriedForwardRef}>
                  <AlertTriangle size={14} />
                  {t("carriedForwardSectionTitle")} ({carriedForward.length})
                </div>
                {groupByCity ? (
                  groupByCityFn(carriedForward).map(([city, cityItems]) => (
                    <div key={city} className="my-day-city-group">
                      <div className="my-day-city-group-title">{city} ({cityItems.length})</div>
                      <QueueTable
                        items={cityItems} t={t} statusLabel={statusLabel}
                        onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                        quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                      />
                    </div>
                  ))
                ) : (
                  <QueueTable
                    items={carriedForward} t={t} statusLabel={statusLabel}
                    onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                    quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                  />
                )}
              </>
            )}

            {todaysQueue.length > 0 && (
              <>
                <div className="my-day-section-header" ref={todaysQueueRef}>
                  <ListChecks size={14} />
                  {t("todaysQueueSectionTitle")} ({todaysQueue.length})
                  {summary?.snoozed_count > 0 && <span className="my-day-snoozed-note">· {t("snoozedNote").replace("{n}", summary.snoozed_count)}</span>}
                  <div className="my-day-sort-toggle">
                    <button className={sortMode === "default" ? "active" : ""} onClick={() => setSortMode("default")}>{t("sortDefault")}</button>
                    <button className={sortMode === "balance" ? "active" : ""} onClick={() => setSortMode("balance")}>{t("sortByBalance")}</button>
                    <button className={sortMode === "overdue_days" ? "active" : ""} onClick={() => setSortMode("overdue_days")}>{t("sortByDaysOverdue")}</button>
                  </div>
                </div>
                {groupByCity ? (
                  groupByCityFn(todaysQueue).map(([city, cityItems]) => (
                    <div key={city} className="my-day-city-group">
                      <div className="my-day-city-group-title">{city} ({cityItems.length})</div>
                      <QueueTable
                        items={cityItems} t={t} statusLabel={statusLabel}
                        onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                        quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                      />
                    </div>
                  ))
                ) : (
                  <QueueTable
                    items={todaysQueue} t={t} statusLabel={statusLabel}
                    onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                    quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                  />
                )}
              </>
            )}

            {notDueYet.length > 0 && (
              <>
                <div className="my-day-section-header not-due" ref={notDueYetRef}>
                  <ChevronRight size={14} className={showNotDueYet ? "my-day-chevron-open" : ""} />
                  <span className="clickable-row" onClick={() => setShowNotDueYet((v) => !v)}>
                    {t("restOfCustomersSectionTitle")} ({notDueYet.length})
                  </span>
                </div>
                {showNotDueYet && (
                  groupByCity ? (
                    groupByCityFn(notDueYet).map(([city, cityItems]) => (
                      <div key={city} className="my-day-city-group">
                        <div className="my-day-city-group-title">{city} ({cityItems.length})</div>
                        <QueueTable
                          items={cityItems} t={t} statusLabel={statusLabel}
                          onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                          quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                        />
                      </div>
                    ))
                  ) : (
                    <QueueTable
                      items={notDueYet} t={t} statusLabel={statusLabel}
                      onQuickCheckin={handleQuickCheckin} onUndo={handleUndo} onOpenHistory={setHistoryCustomer} onSelectCustomer={onSelectCustomer} onSnooze={handleSnooze}
                      quickStatuses={quickStatuses} onQuickOutcome={requestQuickOutcome} nowMs={nowMs} onOpenSettlement={setSettlementCustomer}
                    />
                  )
                )}
              </>
            )}
          </>
        )}
      </div>

      {historyCustomer && <HistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />}
      {showBriefing && summary && <MorningBriefingModal summary={summary} onClose={() => setShowBriefing(false)} t={t} />}
      {outcomeModalStatus && (
        <OutcomeDetailModal
          status={outcomeModalStatus} items={items} onClose={() => setOutcomeModalStatus(null)}
          t={t} statusLabel={statusLabel} onSelectCustomer={onSelectCustomer}
        />
      )}
      {settlementCustomer && (
        <CalculatorModal customer={settlementCustomer} onClose={() => setSettlementCustomer(null)} t={t} money={money} />
      )}
      {quickOutcomeRequest && (
        <QuickOutcomeModal
          customerName={quickOutcomeRequest.name} status={quickOutcomeRequest.status}
          statusLabel={statusLabel} t={t}
          onClose={() => setQuickOutcomeRequest(null)}
          onSubmit={async (note, nextDate) => {
            const { partnerId, status } = quickOutcomeRequest;
            setQuickOutcomeRequest(null);
            await submitQuickOutcome(partnerId, status.name, note, nextDate);
          }}
        />
      )}
    </div>
  );
}
