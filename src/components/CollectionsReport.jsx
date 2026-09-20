import { useEffect, useState } from "react";
import {
  Wallet, Receipt, Users2, Calculator, Download, Search, Trophy, UserCheck2, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import DonutChart from "./DonutChart.jsx";
import { ODOO_COLORS } from "../chartColors.js";

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CollectionsReport({ onSelectCustomer }) {
  const { t, money, lang } = useLang();
  const { showToast } = useToast();
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [hoveredJournal, setHoveredJournal] = useState(null);
  const [journalFilter, setJournalFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    setError(null);
    api.collectionsReport({ date_from: dateFrom, date_to: dateTo })
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [dateFrom, dateTo]);

  const isToday = dateFrom === todayISO() && dateTo === todayISO();

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const filteredPayments = (report?.payments || []).filter((p) => {
    if (journalFilter && (p.journal_name || "—") !== journalFilter) return false;
    if (collectorFilter && (p.collector || "—") !== collectorFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.customer_name || "").toLowerCase().includes(q)
      || (p.reference || "").toLowerCase().includes(q)
      || (p.collector || "").toLowerCase().includes(q);
  });

  const visiblePayments = [...filteredPayments].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "date") cmp = new Date(a.date) - new Date(b.date);
    else if (sortBy === "customer_name") cmp = (a.customer_name || "").localeCompare(b.customer_name || "", "ar");
    else if (sortBy === "amount") cmp = (a.amount || 0) - (b.amount || 0);
    else if (sortBy === "journal_name") cmp = (a.journal_name || "").localeCompare(b.journal_name || "", "ar");
    else if (sortBy === "collector") cmp = (a.collector || "").localeCompare(b.collector || "", "ar");
    else if (sortBy === "reference") cmp = (a.reference || "").localeCompare(b.reference || "", "ar");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await api.exportCollectionsPdf({
        date_from: dateFrom, date_to: dateTo,
        journal: journalFilter || null, collector: collectorFilter || null,
        search: search.trim() || null, lang,
      });
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const journalData = (report?.by_journal || []).map((j, i) => ({
    label: j.journal, value: j.amount, color: ODOO_COLORS[i % ODOO_COLORS.length],
  }));
  const journalTotal = journalData.reduce((s, d) => s + d.value, 0);
  const journalCenterLabel = hoveredJournal ? hoveredJournal.label : t("totalCollected");
  const journalCenterValue = hoveredJournal ? hoveredJournal.value : journalTotal;

  const collectorBarData = (report?.by_collector || []).slice(0, 8).map((c) => ({
    name: c.collector, amount: c.amount,
  }));

  const exportCsv = () => {
    const headers = [t("date"), t("customer"), t("amount"), t("paymentMethod"), t("collectorField"), t("reference")];
    const rows = visiblePayments.map((p) => [
      p.date, p.customer_name, p.amount, p.journal_name || "", p.collector || "", p.reference || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collections-${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Wallet size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("collectionsReportTitle")}</h2>
            <p className="panel-sub">{t("collectionsReportHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exportingPdf || !report}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingPdf ? t("exporting") : t("print")}
          </button>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 16 }}>
          <div className="more-filter-field">
            <label>{t("fromDate")}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="more-filter-field">
            <label>{t("toDate")}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button className="btn-secondary sm" style={{ alignSelf: "flex-end" }} onClick={() => { setDateFrom(todayISO()); setDateTo(todayISO()); }}>
            {t("today")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !report && <div className="loading-state">{t("loadingDots")}</div>}

        {report && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-teal">
                <span className="kpi-pulse kpi-pulse-lg" />
                <span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{isToday ? t("collectedToday") : t("totalCollected")}</div>
                  <div className="insights-kpi-icon"><Wallet size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(report.summary.total_collected)}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-violet">
                <span className="kpi-pulse kpi-pulse-lg" />
                <span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("paymentsCount")}</div>
                  <div className="insights-kpi-icon"><Receipt size={15} /></div>
                </div>
                <div className="insights-kpi-value">{report.summary.payments_count}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-amber">
                <span className="kpi-pulse kpi-pulse-lg" />
                <span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("customersCol")}</div>
                  <div className="insights-kpi-icon"><Users2 size={15} /></div>
                </div>
                <div className="insights-kpi-value">{report.summary.customers_count}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-danger">
                <span className="kpi-pulse kpi-pulse-lg" />
                <span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("avgPayment")}</div>
                  <div className="insights-kpi-icon"><Calculator size={15} /></div>
                </div>
                <div className="insights-kpi-value">
                  {money(report.summary.payments_count > 0 ? report.summary.total_collected / report.summary.payments_count : 0)}
                </div>
                <div className="insights-kpi-bar" />
              </div>
              {report.summary.top_payment && (
                <div className="insights-kpi-card accent-teal">
                  <span className="kpi-pulse kpi-pulse-lg" />
                  <span className="kpi-pulse kpi-pulse-sm" />
                  <div className="insights-kpi-top">
                    <div className="insights-kpi-label">{t("largestPayment")}</div>
                    <div className="insights-kpi-icon"><Trophy size={15} /></div>
                  </div>
                  <div className="insights-kpi-value">{money(report.summary.top_payment.amount)}</div>
                  <div className="insights-kpi-label" style={{ marginTop: 2 }}>{report.summary.top_payment.customer_name}</div>
                </div>
              )}
              {report.by_collector && report.by_collector.length > 0 && (
                <div className="insights-kpi-card accent-violet">
                  <span className="kpi-pulse kpi-pulse-lg" />
                  <span className="kpi-pulse kpi-pulse-sm" />
                  <div className="insights-kpi-top">
                    <div className="insights-kpi-label">{t("topCollector")}</div>
                    <div className="insights-kpi-icon"><UserCheck2 size={15} /></div>
                  </div>
                  <div className="insights-kpi-value insights-kpi-value-sm">{report.by_collector[0].collector}</div>
                  <div className="insights-kpi-label" style={{ marginTop: 2 }}>{money(report.by_collector[0].amount)}</div>
                </div>
              )}
            </div>

            {report.summary.unmatched_count > 0 && (
              <div className="alert-banner danger" style={{ marginBottom: 16 }}>
                <AlertTriangle size={16} />
                {t("unmatchedPaymentsWarning").replace("{n}", report.summary.unmatched_count)}
              </div>
            )}

            {journalData.length === 0 ? (
              <div className="empty-state">{t("noCollectionsInRange")}</div>
            ) : (
              <div className="insights-charts-row" style={{ marginBottom: 20 }}>
                <div className="insights-chart-card">
                  <h3 className="insights-chart-title">{t("byPaymentMethod")}</h3>
                  <div className="donut-demo-wrap">
                    <DonutChart
                      data={journalData}
                      size={165}
                      strokeWidth={19}
                      animationDuration={1}
                      animationDelayPerSegment={0.05}
                      highlightOnHover
                      onSegmentHover={setHoveredJournal}
                      centerContent={
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={journalCenterLabel}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2, ease: "circOut" }}
                            className="donut-center-inner"
                          >
                            <div className="donut-center-label">{journalCenterLabel}</div>
                            <div className="donut-center-value">{money(journalCenterValue)}</div>
                          </motion.div>
                        </AnimatePresence>
                      }
                    />
                    <div className="donut-legend-list">
                      {journalData.map((seg) => (
                        <div
                          key={seg.label}
                          className={`donut-legend-item clickable-row ${hoveredJournal?.label === seg.label ? "active" : ""} ${journalFilter === seg.label ? "selected" : ""}`}
                          onClick={() => setJournalFilter((v) => (v === seg.label ? "" : seg.label))}
                        >
                          <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
                          <span className="donut-legend-label">{seg.label}</span>
                          <span className="donut-legend-value">
                            {money(seg.value)} · {journalTotal > 0 ? Math.round((seg.value / journalTotal) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="insights-chart-card">
                  <h3 className="insights-chart-title">{t("byCollector")}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(180, collectorBarData.length * 34)}>
                    <BarChart data={collectorBarData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                             tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                      <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} width={110} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                      <Bar
                        dataKey="amount" radius={[0, 4, 4, 0]} cursor="pointer"
                        onClick={(d) => setCollectorFilter((v) => (v === d.name ? "" : d.name))}
                      >
                        {collectorBarData.map((d, i) => (
                          <Cell
                            key={d.name} fill={ODOO_COLORS[i % ODOO_COLORS.length]}
                            opacity={collectorFilter && collectorFilter !== d.name ? 0.35 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {(journalFilter || collectorFilter) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {journalFilter && (
                  <span className="table-totals-item active-filter" style={{ cursor: "pointer" }} onClick={() => setJournalFilter("")}>
                    {t("paymentMethod")}: <strong>{journalFilter}</strong> <X size={11} style={{ verticalAlign: -1 }} />
                  </span>
                )}
                {collectorFilter && (
                  <span className="table-totals-item active-filter" style={{ cursor: "pointer" }} onClick={() => setCollectorFilter("")}>
                    {t("collectorField")}: <strong>{collectorFilter}</strong> <X size={11} style={{ verticalAlign: -1 }} />
                  </span>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <div className="search-bar" style={{ maxWidth: 260 }}>
                <Search size={14} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
              </div>
              <button className="btn-secondary sm" onClick={exportCsv} style={{ marginInlineStart: "auto" }} disabled={visiblePayments.length === 0}>
                <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("export")}
              </button>
            </div>

            {visiblePayments.length === 0 ? (
              <div className="empty-state">{t("noCollectionsInRange")}</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => toggleSort("date")}>{t("date")} {sortIcon("date")}</th>
                      <th className="sortable" onClick={() => toggleSort("customer_name")}>{t("customer")} {sortIcon("customer_name")}</th>
                      <th className="sortable" onClick={() => toggleSort("amount")}>{t("amount")} {sortIcon("amount")}</th>
                      <th className="sortable" onClick={() => toggleSort("journal_name")}>{t("paymentMethod")} {sortIcon("journal_name")}</th>
                      <th className="sortable" onClick={() => toggleSort("collector")}>{t("collectorField")} {sortIcon("collector")}</th>
                      <th className="sortable" onClick={() => toggleSort("reference")}>{t("reference")} {sortIcon("reference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePayments.map((p) => (
                      <tr
                        key={p.payment_id}
                        className={p.unmatched ? "" : "clickable-row"}
                        onClick={() => !p.unmatched && onSelectCustomer?.(p.partner_id)}
                      >
                        <td>{fmtDate(p.date)}</td>
                        <td className="cust-name">
                          {p.customer_name}
                          {p.unmatched && <span className="status-tag danger" style={{ marginInlineStart: 6 }}>{t("unmatchedTag")}</span>}
                        </td>
                        <td style={{ color: "var(--ok)", fontWeight: 700 }}><RiyalAmount amount={p.amount} /></td>
                        <td>{p.journal_name || "—"}</td>
                        <td>{p.collector || "—"}</td>
                        <td><bdi dir="ltr">{p.reference || "—"}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
