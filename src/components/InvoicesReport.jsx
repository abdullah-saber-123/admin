import { useEffect, useState, useCallback, Fragment } from "react";
import { Receipt as ReceiptIcon, Search, StickyNote, SlidersHorizontal, Check, X, ChevronDown, ChevronRight, Rows3, Tag, FileWarning, Wallet, Layers, Crown, Clock, CalendarClock, CheckCircle2, Download } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import DonutChart from "./DonutChart.jsx";
import { ODOO_COLORS } from "../chartColors.js";

const REASON_COLORS = ODOO_COLORS;

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};

/** Collapses a sorted-by-`key` groups array into the top N entries plus one
 * "Other" bucket for the remainder, for a chart that stays readable even
 * when there are a dozen+ distinct delay reasons. */
function topNWithOther(groups, key, topN, otherLabel) {
  if (!groups || groups.length === 0) return [];
  const sorted = [...groups].sort((a, b) => b[key] - a[key]);
  const top = sorted.slice(0, topN);
  const restSum = sorted.slice(topN).reduce((s, g) => s + (g[key] || 0), 0);
  const items = top.map((g) => ({ name: g.reason, value: g[key] }));
  if (restSum > 0) items.push({ name: otherLabel, value: restSum });
  return items;
}

/** Custom Pie slice label: only draws the value inside slices big enough to
 * hold readable text (recharts' own inside-label placement gets unreadable
 * and overlapping once several tiny slices sit next to each other). */
function renderPieSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {value}
    </text>
  );
}

// Tax Excluded and Amount Due are hidden by default (per request) but stay
// toggleable via the Columns menu - persisted so the choice sticks.
const OPTIONAL_COLUMN_IDS = ["tax_excluded", "amount_due", "collector"];
const DEFAULT_VISIBLE_OPTIONAL = {};
const NO_REASON_KEY = "__no_reason__";

function relativeDueLabel(dueDateStr, t) {
  if (!dueDateStr) return "—";
  const due = new Date(dueDateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays === 0) return t("dueToday");
  if (diffDays === -1) return t("dueYesterday");
  if (diffDays === 1) return t("dueTomorrow");
  if (diffDays > 1 && diffDays <= 60) return `${t("dueIn")} ${diffDays} ${t("daysLabel")}`;
  if (diffDays < -1 && diffDays >= -60) return `${Math.abs(diffDays)} ${t("daysLabel")} ${t("dueAgo")}`;
  if (diffDays > 60) return `${t("dueIn")} ${Math.round(diffDays / 30)} ${t("monthsLabel")}`;
  if (diffDays < -60) return `${Math.round(Math.abs(diffDays) / 30)} ${t("monthsLabel")} ${t("dueAgo")}`;
  return fmtDate(dueDateStr);
}

function statusLabelFor(payment_state, t) {
  if (payment_state === "paid") return { label: t("statusPaid"), tone: "ok" };
  if (payment_state === "in_payment") return { label: t("statusInPayment"), tone: "teal" };
  if (payment_state === "partial") return { label: t("statusPartial"), tone: "warn" };
  if (payment_state === "reversed") return { label: t("statusReversed"), tone: "faint" };
  return { label: t("statusPosted"), tone: "faint" };
}

function monthLabel(year, month, lang) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "long", year: "numeric" });
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InvoicesReport({ onSelectCustomer }) {
  const { t, lang, money } = useLang();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState([]);
  const [statusSelectOpen, setStatusSelectOpen] = useState(false);
  const [statusSearch, setStatusSearch] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [daysOverdueMin, setDaysOverdueMin] = useState("");
  const [daysOverdueMax, setDaysOverdueMax] = useState("");
  const [dueTodayOnly, setDueTodayOnly] = useState(false);
  const [dueBucket, setDueBucket] = useState(null); // null | "overdue" | "due_today" | "not_due_yet"
  const [selectedDelayReasons, setSelectedDelayReasons] = useState([]);
  const [delayReasonOptions, setDelayReasonOptions] = useState([]);
  const [delayReasonSearch, setDelayReasonSearch] = useState("");
  const [delayReasonSelectOpen, setDelayReasonSelectOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("invoices_visible_columns");
      return saved ? { ...DEFAULT_VISIBLE_OPTIONAL, ...JSON.parse(saved) } : DEFAULT_VISIBLE_OPTIONAL;
    } catch {
      return DEFAULT_VISIBLE_OPTIONAL;
    }
  });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [followupTarget, setFollowupTarget] = useState(null); // { partner_id, customer_name, invoice_number }
  const [followupStatus, setFollowupStatus] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [followupError, setFollowupError] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [exportingReasonPdf, setExportingReasonPdf] = useState(false);

  // Attractive KPI+chart insights panel at the top of the page, built from the
  // same delay-reason breakdown used by the "group by reason" view - always
  // loaded (independent of groupMode) so it's visible regardless of which
  // table view the person is looking at.
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);
  const [statusInsights, setStatusInsights] = useState(null);
  const [hoveredAmountSlice, setHoveredAmountSlice] = useState(null);
  const [compareDate, setCompareDate] = useState("");
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonError, setComparisonError] = useState(null);

  useEffect(() => {
    if (!compareDate) {
      setComparisonData(null);
      return;
    }
    setComparisonError(null);
    api.receivableComparison(compareDate).then(setComparisonData).catch((e) => setComparisonError(e.message));
  }, [compareDate]);

  // Odoo-style "group by" view: collapsed headers (by month or by delay
  // reason) with a count, expanding on click to lazily fetch just that
  // group's invoices. groupMode: "none" | "month" | "reason".
  const [groupMode, setGroupMode] = useState("none");

  const [monthGroups, setMonthGroups] = useState(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(() => new Set());
  const [groupData, setGroupData] = useState({});
  const [groupLoading, setGroupLoading] = useState({});

  const [reasonGroups, setReasonGroups] = useState(null);
  const [reasonGroupsLoading, setReasonGroupsLoading] = useState(false);
  const [reasonGroupsError, setReasonGroupsError] = useState(null);
  const [expandedReasons, setExpandedReasons] = useState(() => new Set());
  const [reasonGroupData, setReasonGroupData] = useState({});
  const [reasonGroupLoading, setReasonGroupLoading] = useState({});

  useEffect(() => {
    api.collectors().then(setCollectors).catch(() => {});
    api.followupStatuses().then(setStatuses).catch(() => {});
    api.invoiceDelayReasons().then(setDelayReasonOptions).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (groupMode !== "none") return;
    setError(null);
    api.invoicesReport({
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket, page, page_size: 30,
    }).then(setData).catch((e) => setError(e.message));
  }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, selectedDelayReasons, dueBucket, page, groupMode]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, selectedDelayReasons, dueBucket]);


  const loadInsights = useCallback(() => {
    setInsightsError(null);
    setInsightsLoading(true);
    api.invoicesReportReasonGroups({
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket,
    })
      .then(setInsights)
      .catch((e) => setInsightsError(e.message))
      .finally(() => setInsightsLoading(false));
    api.invoicesReportStatusGroups({
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket,
    })
      .then(setStatusInsights)
      .catch(() => {});
  }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, selectedDelayReasons, dueBucket]);

  const handleExportReasonPdf = async () => {
    setExportingReasonPdf(true);
    try {
      await api.exportInvoicesByReasonPdf({
        search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo,
        days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
        due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket, lang,
      });
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExportingReasonPdf(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadInsights, 250);
    return () => clearTimeout(timer);
  }, [loadInsights]);

  const loadGroups = useCallback(() => {
    setGroupsError(null);
    setGroupsLoading(true);
    api.invoicesReportMonthGroups({
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket,
    })
      .then((res) => setMonthGroups(res.groups))
      .catch((e) => setGroupsError(e.message))
      .finally(() => setGroupsLoading(false));
  }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, selectedDelayReasons, dueBucket]);

  useEffect(() => {
    if (groupMode !== "month") return;
    setExpandedMonths(new Set());
    setGroupData({});
    setGroupLoading({});
    const timer = setTimeout(loadGroups, 250);
    return () => clearTimeout(timer);
  }, [groupMode, loadGroups]);

  const loadMonthPage = useCallback((year, month, pageNum) => {
    const key = `${year}-${month}`;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    let effFrom = monthStart;
    let effTo = monthEnd;
    if (dateFrom) { const df = new Date(dateFrom); if (df > effFrom) effFrom = df; }
    if (dateTo) { const dt = new Date(dateTo); if (dt < effTo) effTo = dt; }

    setGroupLoading((prev) => ({ ...prev, [key]: true }));
    api.invoicesReport({
      search, status: status.join(","), collector: collectorFilter,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket,
      date_from: toISODate(effFrom), date_to: toISODate(effTo),
      page: pageNum, page_size: 30,
    })
      .then((res) => setGroupData((prev) => ({ ...prev, [key]: res })))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setGroupLoading((prev) => ({ ...prev, [key]: false })));
  }, [search, status, collectorFilter, dueTodayOnly, selectedDelayReasons, dueBucket, dateFrom, dateTo, showToast]);

  const toggleMonth = (year, month) => {
    const key = `${year}-${month}`;
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!groupData[key]) loadMonthPage(year, month, 1);
      }
      return next;
    });
  };

  const loadReasonGroups = useCallback(() => {
    setReasonGroupsError(null);
    setReasonGroupsLoading(true);
    api.invoicesReportReasonGroups({
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, delay_reasons: selectedDelayReasons.join(","), due_bucket: dueBucket,
    })
      .then((res) => setReasonGroups(res.groups))
      .catch((e) => setReasonGroupsError(e.message))
      .finally(() => setReasonGroupsLoading(false));
  }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, selectedDelayReasons, dueBucket]);

  useEffect(() => {
    if (groupMode !== "reason") return;
    setExpandedReasons(new Set());
    setReasonGroupData({});
    setReasonGroupLoading({});
    const timer = setTimeout(loadReasonGroups, 250);
    return () => clearTimeout(timer);
  }, [groupMode, loadReasonGroups]);

  const loadReasonPage = useCallback((reasonKey, pageNum) => {
    setReasonGroupLoading((prev) => ({ ...prev, [reasonKey]: true }));
    const params = {
      search, status: status.join(","), collector: collectorFilter, date_from: dateFrom, date_to: dateTo, days_overdue_min: daysOverdueMin || null, days_overdue_max: daysOverdueMax || null,
      due_today: dueTodayOnly, due_bucket: dueBucket, page: pageNum, page_size: 30,
    };
    if (reasonKey === NO_REASON_KEY) {
      params.no_reason = true;
    } else {
      params.delay_reasons = reasonKey;
    }
    api.invoicesReport(params)
      .then((res) => setReasonGroupData((prev) => ({ ...prev, [reasonKey]: res })))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setReasonGroupLoading((prev) => ({ ...prev, [reasonKey]: false })));
  }, [search, status, collectorFilter, dateFrom, dateTo, daysOverdueMin, daysOverdueMax, dueTodayOnly, dueBucket, showToast]);

  const toggleReason = (reasonKey) => {
    setExpandedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reasonKey)) {
        next.delete(reasonKey);
      } else {
        next.add(reasonKey);
        if (!reasonGroupData[reasonKey]) loadReasonPage(reasonKey, 1);
      }
      return next;
    });
  };

  const colCount = 9
    + (visibleColumns.tax_excluded ? 1 : 0)
    + (visibleColumns.amount_due ? 1 : 0)
    + (visibleColumns.collector ? 1 : 0);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  const openFollowup = (inv) => {
    setFollowupTarget({ partner_id: inv.partner_id, customer_name: inv.customer_name, invoice_number: inv.number });
    setFollowupStatus(statuses[0]?.name || "");
    setFollowupNote("");
    setFollowupDate("");
    setFollowupError(null);
  };

  const renderInvoiceRow = (inv) => {
    const st = statusLabelFor(inv.status, t);
    const isOverdueLabel = inv.due_date && new Date(inv.due_date) < new Date() && inv.amount_due > 0;
    return (
      <tr key={inv.invoice_id}>
        <td data-label={t("invoiceNumber")}>
          <bdi dir="ltr">{inv.number}{inv.is_credit_note ? ` (${t("creditNote")})` : ""}</bdi>
        </td>
        <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(inv.partner_id)}>
          <span className="cust-name">{inv.customer_name}</span>
        </td>
        <td data-label={t("invoiceDate")}>{fmtDate(inv.invoice_date)}</td>
        <td data-label={t("dueDate")}>
          <span className={isOverdueLabel ? "overdue-text" : ""}>{relativeDueLabel(inv.due_date, t)}</span>
        </td>
        {visibleColumns.tax_excluded && (
          <td data-label={t("taxExcluded")}><RiyalAmount amount={inv.amount_untaxed} /></td>
        )}
        <td data-label={t("amount")}><RiyalAmount amount={inv.amount_total} /></td>
        {visibleColumns.amount_due && (
          <td data-label={t("amountDue")}>
            {inv.amount_due > 0 ? <RiyalAmount amount={inv.amount_due} /> : <span className="due-amount zero">0.00</span>}
          </td>
        )}
        <td data-label={t("paidAmount")}>{inv.paid_amount ? <RiyalAmount amount={inv.paid_amount} /> : "—"}</td>
        {visibleColumns.collector && <td data-label={t("collectorField")}>{inv.collector || "—"}</td>}
        <td data-label={t("status")}>
          <span className={`fu-tag ${st.tone}`}>{st.label}</span>
        </td>
        <td data-label={t("draftDelayReason")}>{inv.draft_delay_reason || "—"}</td>
        <td>
          <button className="btn-secondary sm" onClick={() => openFollowup(inv)}>
            <StickyNote size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
            {t("followUp")}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><ReceiptIcon size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("invoicesReportTitle")}</h2>
            <p className="panel-sub">{t("invoicesReportHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExportReasonPdf} disabled={exportingReasonPdf}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingReasonPdf ? t("exporting") : t("printDelayReasonReport")}
          </button>
        </div>

        <InsightsPanel insights={insights} loading={insightsLoading} error={insightsError} t={t} money={money}
          hoveredAmountSlice={hoveredAmountSlice} setHoveredAmountSlice={setHoveredAmountSlice} />

        <StatusInsightsPanel data={statusInsights} t={t} money={money} dueBucket={dueBucket} onSelectDueBucket={(b) => setDueBucket((prev) => (prev === b ? null : b))} />

        <div className="receivable-compare-card">
          <div className="receivable-compare-head">
            <strong>{t("compareReceivableTitle")}</strong>
            <input
              type="date" value={compareDate} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCompareDate(e.target.value)}
            />
          </div>
          {comparisonError && <div className="error-state">{comparisonError}</div>}
          {compareDate && !comparisonError && !comparisonData && <div className="loading-state">{t("loadingDots")}</div>}
          {comparisonData && (
            comparisonData.compare.total_balance === null ? (
              <div className="empty-state">{t("noSnapshotForDate")}</div>
            ) : (
              <div className="receivable-compare-grid">
                <div className="receivable-compare-col">
                  <div className="receivable-compare-label">{t("todayLabel")}</div>
                  <div className="receivable-compare-value">{money(comparisonData.today.total_balance)}</div>
                  <div className="receivable-compare-sub">{t("overdue")}: {money(comparisonData.today.total_overdue)}</div>
                </div>
                <div className="receivable-compare-col">
                  <div className="receivable-compare-label">{fmtDate(comparisonData.compare.date)}</div>
                  <div className="receivable-compare-value">{money(comparisonData.compare.total_balance)}</div>
                  <div className="receivable-compare-sub">{t("overdue")}: {money(comparisonData.compare.total_overdue)}</div>
                </div>
                <div className="receivable-compare-col">
                  <div className="receivable-compare-label">{t("changeLabel")}</div>
                  <div className={`receivable-compare-value ${comparisonData.diff.balance_amount > 0 ? "up" : comparisonData.diff.balance_amount < 0 ? "down" : ""}`}>
                    {comparisonData.diff.balance_amount > 0 ? "+" : ""}{money(comparisonData.diff.balance_amount)}
                    {comparisonData.diff.balance_pct !== null && (
                      <span className="receivable-compare-pct"> ({comparisonData.diff.balance_pct > 0 ? "+" : ""}{comparisonData.diff.balance_pct}%)</span>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, position: "relative" }}>
          <button className="btn-secondary sm" onClick={() => setShowColumnsMenu((v) => !v)}>
            <SlidersHorizontal size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("columns")}
          </button>
          {showColumnsMenu && (
            <>
              <div className="columns-menu-backdrop" onClick={() => setShowColumnsMenu(false)} />
              <div className="columns-menu">
                {OPTIONAL_COLUMN_IDS.map((id) => (
                  <label key={id} className="multiselect-item">
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[id]}
                      onChange={() => {
                        setVisibleColumns((prev) => {
                          const next = { ...prev, [id]: !prev[id] };
                          localStorage.setItem("invoices_visible_columns", JSON.stringify(next));
                          return next;
                        });
                      }}
                    />
                    {id === "tax_excluded" ? t("taxExcluded") : id === "amount_due" ? t("amountDue") : t("collectorField")}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="more-filters-row" style={{ marginBottom: 10 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("status")}</label>
            <DelayReasonSelect
              options={["not_paid", "paid", "in_payment", "partial"]}
              selected={status}
              onChange={setStatus}
              search={statusSearch}
              onSearchChange={setStatusSearch}
              open={statusSelectOpen}
              onToggle={() => setStatusSelectOpen((v) => !v)}
              onClose={() => { setStatusSelectOpen(false); setStatusSearch(""); }}
              t={t}
              labelFor={(v) => ({ not_paid: t("statusPosted"), paid: t("statusPaid"), in_payment: t("statusInPayment"), partial: t("statusPartial") }[v] || v)}
            />
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field">
              <label>{t("collectorField")}</label>
              <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div className="more-filter-field">
            <label>{t("fromDate")}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={dueTodayOnly} />
          </div>
          <div className="more-filter-field">
            <label>{t("toDate")}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={dueTodayOnly} />
          </div>
          <div className="more-filter-field">
            <label>{t("daysOverdueMin")}</label>
            <input type="number" min="0" value={daysOverdueMin} onChange={(e) => setDaysOverdueMin(e.target.value)} placeholder="0" style={{ width: 80 }} />
          </div>
          <div className="more-filter-field">
            <label>{t("daysOverdueMax")}</label>
            <input type="number" min="0" value={daysOverdueMax} onChange={(e) => setDaysOverdueMax(e.target.value)} placeholder="—" style={{ width: 80 }} />
          </div>
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("draftDelayReason")}</label>
            <DelayReasonSelect
              options={delayReasonOptions}
              selected={selectedDelayReasons}
              onChange={setSelectedDelayReasons}
              search={delayReasonSearch}
              onSearchChange={setDelayReasonSearch}
              open={delayReasonSelectOpen}
              onToggle={() => setDelayReasonSelectOpen((v) => !v)}
              onClose={() => { setDelayReasonSelectOpen(false); setDelayReasonSearch(""); }}
              t={t}
            />
          </div>
        </div>
        <div className="quick-toggle-row" style={{ marginBottom: 14 }}>
          <button
            className={`quick-toggle-chip ${dueTodayOnly ? "active" : ""}`}
            onClick={() => setDueTodayOnly((v) => !v)}
          >
            {t("dueTodayFilterChip")}
          </button>
          <button
            className={`quick-toggle-chip ${groupMode === "month" ? "active" : ""}`}
            onClick={() => setGroupMode((m) => (m === "month" ? "none" : "month"))}
          >
            <Rows3 size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("groupByMonth")}
          </button>
          <button
            className={`quick-toggle-chip ${groupMode === "reason" ? "active" : ""}`}
            onClick={() => setGroupMode((m) => (m === "reason" ? "none" : "reason"))}
          >
            <Tag size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("groupByReason")}
          </button>
        </div>

        {groupMode === "none" && (
          <>
            {error && <div className="error-state">{error}</div>}
            {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
            {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
          </>
        )}

        {groupMode === "none" && data && data.results.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("invoiceNumber")}</th>
                    <th>{t("customer")}</th>
                    <th>{t("invoiceDate")}</th>
                    <th>{t("dueDate")}</th>
                    {visibleColumns.tax_excluded && <th>{t("taxExcluded")}</th>}
                    <th>{t("amount")}</th>
                    {visibleColumns.amount_due && <th>{t("amountDue")}</th>}
                    <th>{t("paidAmount")}</th>
                    {visibleColumns.collector && <th>{t("collectorField")}</th>}
                    <th>{t("status")}</th>
                    <th>{t("draftDelayReason")}</th>
                    <th>{t("followUp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(renderInvoiceRow)}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
              <span className="page-info">{page} / {totalPages} · {data.total}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
            </div>
          </>
        )}

        {groupMode === "month" && (
          <>
            {groupsError && <div className="error-state">{groupsError}</div>}
            {!groupsError && groupsLoading && !monthGroups && <div className="loading-state">{t("loadingDots")}</div>}
            {!groupsLoading && monthGroups && monthGroups.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

            {monthGroups && monthGroups.length > 0 && (
              <div className="table-wrap">
                <table className="data-table month-grouped-table">
                  <thead>
                    <tr>
                      <th>{t("invoiceNumber")}</th>
                      <th>{t("customer")}</th>
                      <th>{t("invoiceDate")}</th>
                      <th>{t("dueDate")}</th>
                      {visibleColumns.tax_excluded && <th>{t("taxExcluded")}</th>}
                      <th>{t("amount")}</th>
                      {visibleColumns.amount_due && <th>{t("amountDue")}</th>}
                      <th>{t("paidAmount")}</th>
                      {visibleColumns.collector && <th>{t("collectorField")}</th>}
                      <th>{t("status")}</th>
                      <th>{t("draftDelayReason")}</th>
                      <th>{t("followUp")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthGroups.map((g) => {
                      const key = `${g.year}-${g.month}`;
                      const isOpen = expandedMonths.has(key);
                      const gd = groupData[key];
                      const gTotalPages = gd ? Math.max(1, Math.ceil(gd.total / gd.page_size)) : 1;
                      return (
                        <Fragment key={key}>
                          <tr className="month-group-row" onClick={() => toggleMonth(g.year, g.month)}>
                            <td colSpan={colCount}>
                              <span className="month-group-toggle">
                                <ChevronRight size={15} className={`month-group-caret ${isOpen ? "open" : ""}`} />
                                <span className="month-group-label">{monthLabel(g.year, g.month, lang)}</span>
                                <span className="month-group-count">{g.count}</span>
                              </span>
                            </td>
                          </tr>
                          {isOpen && groupLoading[key] && !gd && (
                            <tr className="month-group-subrow"><td colSpan={colCount}><div className="loading-state">{t("loadingDots")}</div></td></tr>
                          )}
                          {isOpen && gd && gd.results.map(renderInvoiceRow)}
                          {isOpen && gd && gd.total > gd.page_size && (
                            <tr className="month-group-subrow">
                              <td colSpan={colCount}>
                                <div className="pagination">
                                  <button
                                    disabled={gd.page <= 1 || groupLoading[key]}
                                    onClick={() => loadMonthPage(g.year, g.month, gd.page - 1)}
                                  >
                                    {t("prev")}
                                  </button>
                                  <span className="page-info">{gd.page} / {gTotalPages} · {gd.total}</span>
                                  <button
                                    disabled={gd.page >= gTotalPages || groupLoading[key]}
                                    onClick={() => loadMonthPage(g.year, g.month, gd.page + 1)}
                                  >
                                    {t("next")}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {groupMode === "reason" && (
          <>
            {reasonGroupsError && <div className="error-state">{reasonGroupsError}</div>}
            {!reasonGroupsError && reasonGroupsLoading && !reasonGroups && <div className="loading-state">{t("loadingDots")}</div>}
            {!reasonGroupsLoading && reasonGroups && reasonGroups.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

            {reasonGroups && reasonGroups.length > 0 && (
              <div className="table-wrap">
                <table className="data-table month-grouped-table">
                  <thead>
                    <tr>
                      <th>{t("invoiceNumber")}</th>
                      <th>{t("customer")}</th>
                      <th>{t("invoiceDate")}</th>
                      <th>{t("dueDate")}</th>
                      {visibleColumns.tax_excluded && <th>{t("taxExcluded")}</th>}
                      <th>{t("amount")}</th>
                      {visibleColumns.amount_due && <th>{t("amountDue")}</th>}
                      <th>{t("paidAmount")}</th>
                      {visibleColumns.collector && <th>{t("collectorField")}</th>}
                      <th>{t("status")}</th>
                      <th>{t("draftDelayReason")}</th>
                      <th>{t("followUp")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reasonGroups.map((g) => {
                      const key = g.reason || NO_REASON_KEY;
                      const isOpen = expandedReasons.has(key);
                      const gd = reasonGroupData[key];
                      const gTotalPages = gd ? Math.max(1, Math.ceil(gd.total / gd.page_size)) : 1;
                      return (
                        <Fragment key={key}>
                          <tr className="month-group-row" onClick={() => toggleReason(key)}>
                            <td colSpan={colCount}>
                              <span className="month-group-toggle">
                                <ChevronRight size={15} className={`month-group-caret ${isOpen ? "open" : ""}`} />
                                <span className="month-group-label">{g.reason || t("noDelayReasonSet")}</span>
                                <span className="month-group-amount">{money(g.amount)}</span>
                                <span className="month-group-count">{g.count}</span>
                              </span>
                            </td>
                          </tr>
                          {isOpen && reasonGroupLoading[key] && !gd && (
                            <tr className="month-group-subrow"><td colSpan={colCount}><div className="loading-state">{t("loadingDots")}</div></td></tr>
                          )}
                          {isOpen && gd && gd.results.map(renderInvoiceRow)}
                          {isOpen && gd && gd.total > gd.page_size && (
                            <tr className="month-group-subrow">
                              <td colSpan={colCount}>
                                <div className="pagination">
                                  <button
                                    disabled={gd.page <= 1 || reasonGroupLoading[key]}
                                    onClick={() => loadReasonPage(key, gd.page - 1)}
                                  >
                                    {t("prev")}
                                  </button>
                                  <span className="page-info">{gd.page} / {gTotalPages} · {gd.total}</span>
                                  <button
                                    disabled={gd.page >= gTotalPages || reasonGroupLoading[key]}
                                    onClick={() => loadReasonPage(key, gd.page + 1)}
                                  >
                                    {t("next")}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {followupTarget && (
        <div className="overlay modal-overlay" onClick={() => setFollowupTarget(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("followUp")} — <bdi dir="ltr">{followupTarget.invoice_number}</bdi></h3>
            <p className="prompt-message">{followupTarget.customer_name}</p>
            <div className="admin-form" style={{ maxWidth: "none" }}>
              <label>{t("status")}</label>
              <select value={followupStatus} onChange={(e) => setFollowupStatus(e.target.value)}>
                {statuses.filter((s) => s.name !== "Not Contacted").map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <label>{t("noteRequired")}</label>
              <input value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} placeholder={t("followupHint")} autoFocus />
              <label>{t("nextFollowupDate")}</label>
              <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
              {followupError && <div className="error-state">{followupError}</div>}
            </div>
            <div className="prompt-actions">
              <button className="btn-secondary" onClick={() => setFollowupTarget(null)}>{t("cancel")}</button>
              <button
                className="btn-primary"
                disabled={savingFollowup || !followupNote.trim() || !followupStatus}
                onClick={async () => {
                  setSavingFollowup(true);
                  setFollowupError(null);
                  try {
                    await api.logFollowup(followupTarget.partner_id, {
                      status: followupStatus,
                      note: followupNote.trim(),
                      next_follow_up_date: followupDate || null,
                      invoice_number: followupTarget.invoice_number,
                    });
                    showToast(t("saved"), "success");
                    setFollowupTarget(null);
                  } catch (e) {
                    setFollowupError(e.message);
                  } finally {
                    setSavingFollowup(false);
                  }
                }}
              >
                {savingFollowup ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_CHART_COLORS = { not_paid: "#F4A460", paid: "#30C381", in_payment: "#5750f1", partial: "#D6145F", reversed: "#8a8f98" };

function StatusInsightsPanel({ data, t, money, dueBucket, onSelectDueBucket }) {
  if (!data) return null;
  const statusLabelMap = { not_paid: t("statusPosted"), paid: t("statusPaid"), in_payment: t("statusInPayment"), partial: t("statusPartial"), reversed: t("statusReversed") };
  const chartData = data.status_groups.map((g) => ({ ...g, label: statusLabelMap[g.status] || g.label }));
  const { due } = data;

  return (
    <div className="insights-panel">
      <h3 className="insights-panel-title">{t("statusInsightsPanelTitle")}</h3>
      <div className="status-insights-grid">
        <div className="status-insights-chart">
          {chartData.length === 0 ? (
            <div className="empty-state">{t("noActivity")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {chartData.map((g, i) => <Cell key={i} fill={STATUS_CHART_COLORS[g.status] || "#999"} />)}
                </Pie>
                <RTooltip formatter={(v, n, p) => [`${v} (${money(p.payload.amount)})`, p.payload.label]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="status-insights-legend">
            {chartData.map((g, i) => (
              <div key={i} className="status-insights-legend-row">
                <span className="status-insights-legend-dot" style={{ background: STATUS_CHART_COLORS[g.status] || "#999" }} />
                <span className="status-insights-legend-label-col">
                  <span>{g.label}</span>
                  <span className="status-insights-legend-amount">{money(g.amount)}</span>
                </span>
                <span className="status-insights-legend-count">{g.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="status-insights-due">
          <div
            className={`due-insight-card overdue clickable-row ${dueBucket === "overdue" ? "active" : ""}`}
            onClick={() => onSelectDueBucket?.("overdue")}
            title={t("dueBucketFilterHint")}
          >
            <div className="due-insight-icon"><Clock size={16} /></div>
            <div>
              <div className="due-insight-label">{t("overdueAndUnpaidLabel")}</div>
              <div className="due-insight-value">{due.overdue.count}</div>
              <div className="due-insight-amount"><RiyalAmount amount={due.overdue.amount} /></div>
            </div>
          </div>
          <div
            className={`due-insight-card today clickable-row ${dueBucket === "due_today" ? "active" : ""}`}
            onClick={() => onSelectDueBucket?.("due_today")}
            title={t("dueBucketFilterHint")}
          >
            <div className="due-insight-icon"><CalendarClock size={16} /></div>
            <div>
              <div className="due-insight-label">{t("myDayDueToday")}</div>
              <div className="due-insight-value">{due.due_today.count}</div>
              <div className="due-insight-amount"><RiyalAmount amount={due.due_today.amount} /></div>
            </div>
          </div>
          <div
            className={`due-insight-card upcoming clickable-row ${dueBucket === "not_due_yet" ? "active" : ""}`}
            onClick={() => onSelectDueBucket?.("not_due_yet")}
            title={t("dueBucketFilterHint")}
          >
            <div className="due-insight-icon"><CheckCircle2 size={16} /></div>
            <div>
              <div className="due-insight-label">{t("notDueYetLabel")}</div>
              <div className="due-insight-value">{due.not_due_yet.count}</div>
              <div className="due-insight-amount"><RiyalAmount amount={due.not_due_yet.amount} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({ insights, loading, error, t, money, hoveredAmountSlice, setHoveredAmountSlice }) {
  if (error) return <div className="error-state" style={{ marginBottom: 14 }}>{error}</div>;
  if (!insights && loading) return <div className="insights-panel skeleton" />;
  if (!insights) return null;

  const { summary, groups } = insights;
  if (!summary || summary.total_invoices === 0) return null;

  const normalized = groups.map((g) => ({ ...g, reason: g.reason || t("noDelayReasonSet") }));
  const countData = topNWithOther(normalized, "count", 6, t("otherReasons")).map((d, i) => ({
    name: d.name, value: d.value, color: REASON_COLORS[i % REASON_COLORS.length],
  }));
  const countTotal = countData.reduce((s, d) => s + d.value, 0);
  const amountData = topNWithOther(normalized, "amount", 6, t("otherReasons")).map((d, i) => ({
    label: d.name, value: d.value, color: REASON_COLORS[i % REASON_COLORS.length],
  }));

  const centerLabel = hoveredAmountSlice ? hoveredAmountSlice.label : t("totalAmount");
  const centerValue = hoveredAmountSlice ? hoveredAmountSlice.value : summary.total_amount;
  const centerPct = hoveredAmountSlice && summary.total_amount > 0
    ? Math.round((hoveredAmountSlice.value / summary.total_amount) * 100)
    : null;

  return (
    <div className="insights-panel">
      <h3 className="insights-panel-title">{t("insightsPanelTitle")}</h3>
      <div className="insights-kpi-grid">
        <div className="insights-kpi-card accent-violet">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("totalDelayedInvoices")}</div>
            <div className="insights-kpi-icon"><FileWarning size={15} /></div>
          </div>
          <div className="insights-kpi-value">{summary.with_reason_count.toLocaleString()}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-danger">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("totalAmountTiedUp")}</div>
            <div className="insights-kpi-icon"><Wallet size={15} /></div>
          </div>
          <div className="insights-kpi-value">{money(summary.total_amount)}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-teal">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("reasonsInUse")}</div>
            <div className="insights-kpi-icon"><Layers size={15} /></div>
          </div>
          <div className="insights-kpi-value">{summary.distinct_reason_count.toLocaleString()}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-amber">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("topReason")} · {summary.top_reason?.count || 0}</div>
            <div className="insights-kpi-icon"><Crown size={15} /></div>
          </div>
          <div className="insights-kpi-value insights-kpi-value-sm">{summary.top_reason?.reason || "—"}</div>
          <div className="insights-kpi-bar" />
        </div>
      </div>

      <div className="insights-charts-row">
        <div className="insights-chart-card">
          <h3 className="insights-chart-title">{t("countByReason")}</h3>
          <div className="donut-demo-wrap">
            <ResponsiveContainer width="100%" height={175}>
              <PieChart>
                <Pie
                  data={countData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={28}
                  outerRadius={70}
                  paddingAngle={4}
                  cornerRadius={8}
                  isAnimationActive
                  labelLine={false}
                  label={(props) => renderPieSliceLabel(props)}
                >
                  {countData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="none" />
                  ))}
                </Pie>
                <RTooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend-list">
              {countData.map((seg) => (
                <div key={seg.name} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
                  <span className="donut-legend-label">{seg.name}</span>
                  <span className="donut-legend-value">
                    {seg.value.toLocaleString()} · {countTotal > 0 ? Math.round((seg.value / countTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="insights-chart-card">
          <h3 className="insights-chart-title">{t("amountByReason")}</h3>
          <div className="donut-demo-wrap">
            <DonutChart
              data={amountData}
              size={165}
              strokeWidth={19}
              animationDuration={1}
              animationDelayPerSegment={0.05}
              highlightOnHover
              onSegmentHover={setHoveredAmountSlice}
              centerContent={
                <AnimatePresence mode="wait">
                  <motion.div
                    key={centerLabel}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "circOut" }}
                    className="donut-center-inner"
                  >
                    <div className="donut-center-label">{centerLabel}</div>
                    <div className="donut-center-value">{money(centerValue)}</div>
                    {centerPct !== null && <div className="donut-center-pct">[{centerPct}%]</div>}
                  </motion.div>
                </AnimatePresence>
              }
            />
            <div className="donut-legend-list">
              {amountData.map((seg) => (
                <div
                  key={seg.label}
                  className={`donut-legend-item ${hoveredAmountSlice?.label === seg.label ? "active" : ""}`}
                  onMouseEnter={() => setHoveredAmountSlice(seg)}
                  onMouseLeave={() => setHoveredAmountSlice(null)}
                >
                  <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
                  <span className="donut-legend-label">{seg.label}</span>
                  <span className="donut-legend-value">{money(seg.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DelayReasonSelect({ options, selected, onChange, search, onSearchChange, open, onToggle, onClose, t, labelFor, placeholder }) {
  const getLabel = labelFor || ((r) => r);
  const filtered = options.filter((r) => getLabel(r).toLowerCase().includes(search.toLowerCase()));
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.includes(r));

  const toggleOne = (r) => {
    onChange(selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r]);
  };
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      onChange(selected.filter((x) => !filtered.includes(x)));
    } else {
      onChange([...new Set([...selected, ...filtered])]);
    }
  };

  const MAX_CHIPS = 2;
  const visibleChips = selected.slice(0, MAX_CHIPS);
  const overflowCount = selected.length - visibleChips.length;

  return (
    <div className="delay-select">
      <button type="button" className={`delay-select-trigger ${open ? "open" : ""}`} onClick={onToggle}>
        {selected.length === 0 ? (
          <span className="delay-select-placeholder">{placeholder || t("allStatus")}</span>
        ) : (
          <span className="delay-select-chips">
            {visibleChips.map((r) => (
              <span key={r} className="delay-chip">
                <span className="delay-chip-text">{getLabel(r)}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  className="delay-chip-x"
                  onClick={(e) => { e.stopPropagation(); toggleOne(r); }}
                >
                  <X size={10} />
                </span>
              </span>
            ))}
            {overflowCount > 0 && <span className="delay-chip delay-chip-more">+{overflowCount}</span>}
          </span>
        )}
        <ChevronDown size={14} className="delay-select-caret" />
      </button>

      {open && (
        <>
          <div className="columns-menu-backdrop" onClick={onClose} />
          <div className="delay-select-panel">
            <div className="multiselect-search">
              <Search size={12} />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <div className="delay-select-actions">
              <button type="button" onClick={toggleAllFiltered}>
                {allFilteredSelected ? t("clearAll") : t("selectAll")}
              </button>
              {selected.length > 0 && (
                <button type="button" className="danger" onClick={() => onChange([])}>
                  {t("clearAll")}
                </button>
              )}
            </div>
            <div className="delay-select-scroll">
              {filtered.length === 0 && <div className="delay-select-empty">{t("noOptionsFound")}</div>}
              {filtered.map((r) => {
                const isSel = selected.includes(r);
                return (
                  <div key={r} className={`delay-select-option ${isSel ? "selected" : ""}`} onClick={() => toggleOne(r)}>
                    <span className="delay-select-check">{isSel && <Check size={12} />}</span>
                    <span className="delay-select-option-text">{getLabel(r)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
