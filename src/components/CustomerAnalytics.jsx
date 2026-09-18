import { useEffect, useState, useCallback } from "react";
import { BarChart3, Search, X, TrendingUp, TrendingDown, Minus, Wallet, Gauge, Repeat, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";
import { fmtDate } from "../dateUtils.js";

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff", border: "1px solid #e6e9f2", borderRadius: 8,
  fontSize: 12, color: "#1c2233", boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};
const GRADE_TONE = { A: "ok", B: "teal", C: "warn", D: "danger" };
const RISK_TONE = { high: "danger", medium: "warn", low: "ok" };
const AGING_BUCKET_KEYS = {
  "1-30": "agingBucket130", "31-60": "agingBucket3160", "61-90": "agingBucket6190",
  "91-180": "agingBucket90plus", "180+": "agingBucket180plus", never_paid: "agingBucketNeverPaid",
};

function monthLabel(m, lang) {
  const d = new Date(2000, m - 1, 1);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short" });
}

function TrendIcon({ trend }) {
  if (trend === "up") return <TrendingUp size={13} color="#17974a" />;
  if (trend === "down") return <TrendingDown size={13} color="#e5484d" />;
  return <Minus size={13} color="#9ca3af" />;
}

export default function CustomerAnalytics({ onSelectCustomer }) {
  const { t, lang, money } = useLang();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [regionFilter, setRegionFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [rankTab, setRankTab] = useState("sales");
  const [monthDrilldown, setMonthDrilldown] = useState(null); // { monthKey, label }
  const [monthRows, setMonthRows] = useState(null);
  const [monthError, setMonthError] = useState(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    api.fieldOptions("region").then((opts) => setRegions(opts.map((o) => o.value))).catch(() => {});
    api.cities().then(setCities).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  const loadOverview = useCallback(() => {
    setError(null);
    api.customerAnalyticsOverview({ year, region: regionFilter, city: cityFilter, collector: collectorFilter })
      .then(setOverview).catch((e) => setError(e.message));
  }, [year, regionFilter, cityFilter, collectorFilter]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api.customers({ search: search.trim(), page_size: 8 }).then((data) => setSearchResults(data.results)).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const pickCustomer = (c) => {
    setSelectedCustomer({ partner_id: c.partner_id, name: c.name });
    setSearch("");
    setSearchResults(null);
    setDetail(null);
    setDetailError(null);
    api.customerAnalyticsDetail(c.partner_id, year).then(setDetail).catch((e) => setDetailError(e.message));
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setDetail(null);
    setDetailError(null);
  };

  const openMonth = (m) => {
    const monthKey = `${year}-${String(m.month).padStart(2, "0")}`;
    setMonthDrilldown({ monthKey, label: monthLabel(m.month, lang) });
    setMonthRows(null);
    setMonthError(null);
    api.monthlyReportCustomers(monthKey).then(setMonthRows).catch((e) => setMonthError(e.message));
  };

  const chartData = overview ? overview.monthly.map((m) => ({ label: monthLabel(m.month, lang), sales: m.sales, payments: m.payments, other_credits: m.other_credits, month: m.month })) : [];
  const detailChartData = detail ? detail.monthly.map((m) => ({ label: monthLabel(m.month, lang), sales: m.sales, payments: m.payments, other_credits: m.other_credits })) : [];
  const ranked = overview ? (rankTab === "sales" ? overview.top_by_sales : overview.top_by_payments) : [];

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><BarChart3 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customerAnalyticsTitle")}</h2>
        <p className="panel-sub">{t("customerAnalyticsHint")}</p>

        <div className="search-bar" style={{ maxWidth: 320, marginBottom: 16, position: "relative" }}>
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchCustomerForReport")} />
          {searchResults && searchResults.length > 0 && (
            <div className="monthly-report-search-results">
              {searchResults.map((c) => (
                <button key={c.partner_id} className="global-search-result" onClick={() => pickCustomer(c)}>
                  <span className="gsr-title">{c.name}</span>
                  <span className="gsr-sub">{c.phone || ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="panel" style={{ marginBottom: 20, background: "var(--card)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {t("fullAnalysisFor")}: <span className="cust-name" style={{ cursor: "pointer", color: "var(--primary)" }} onClick={() => onSelectCustomer?.(selectedCustomer.partner_id)}>{selectedCustomer.name}</span>
                {detail && (
                  <span className={`fu-tag ${RISK_TONE[detail.risk_level]}`}>
                    {detail.risk_level === "high" && <AlertTriangle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />}
                    {t("riskLevel")}: {t(detail.risk_level === "high" ? "riskHigh" : detail.risk_level === "medium" ? "riskMedium" : "riskLow")}
                  </span>
                )}
                {detail?.write_off_status === "approved" && <span className="fu-tag danger">{t("writtenOffBadge")}</span>}
                {detail?.write_off_status === "pending" && <span className="fu-tag warn">{t("writeOffStatus_pending")}</span>}
              </h3>
              <button className="icon-btn" onClick={clearCustomer} title={t("cancel")}><X size={15} /></button>
            </div>

            {detailError && <div className="error-state">{detailError}</div>}
            {!detailError && !detail && <div className="loading-state">{t("loadingDots")}</div>}

            {detail && (
              <>
                <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
                  <div className="insights-kpi-card accent-violet">
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("commitmentRatio")}</div>
                      <div className="insights-kpi-icon"><ShieldCheck size={15} /></div>
                    </div>
                    <div className="insights-kpi-value">{detail.commitment_ratio !== null ? `${detail.commitment_ratio}%` : "—"}</div>
                    <div className="insights-kpi-bar" />
                  </div>
                  <div className="insights-kpi-card accent-teal">
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("turnoverRate")}</div>
                      <div className="insights-kpi-icon"><Repeat size={15} /></div>
                    </div>
                    <div className="insights-kpi-value">{detail.turnover_rate !== null ? `${detail.turnover_rate}x` : "—"}</div>
                    <div className="insights-kpi-bar" />
                    {detail.dso_days !== null && <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "4px 0 0" }}>{t("dsoLabel")}: {detail.dso_days} {t("daysUnit")}</p>}
                  </div>
                  <div className="insights-kpi-card accent-amber">
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("reliabilityScore")}</div>
                      <div className="insights-kpi-icon"><Gauge size={15} /></div>
                    </div>
                    <div className="insights-kpi-value">
                      {detail.score} <span className={`fu-tag ${GRADE_TONE[detail.grade]}`} style={{ marginInlineStart: 6 }}>{detail.grade}</span>
                    </div>
                    <div className="insights-kpi-bar" />
                  </div>
                  <div className="insights-kpi-card accent-danger">
                    <div className="insights-kpi-top">
                      <div className="insights-kpi-label">{t("balanceDue")}</div>
                      <div className="insights-kpi-icon"><Wallet size={15} /></div>
                    </div>
                    <div className="insights-kpi-value insights-kpi-value-sm"><RiyalAmount amount={detail.current_due} /></div>
                  </div>
                </div>

                <div className="table-totals-row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
                  <span className="table-totals-item">{t("cityLabel")}: <strong>{detail.city || "—"}</strong></span>
                  <span className="table-totals-item">{t("regionLabel")}: <strong>{detail.region || "—"}</strong></span>
                  <span className="table-totals-item">{t("collectorField")}: <strong>{detail.collector || "—"}</strong></span>
                  <span className="table-totals-item">{t("paymentTypeLabel")}: <strong>{detail.payment_type || "—"}</strong></span>
                  <span className="table-totals-item">{t("invoicedSales")} ({year}): <strong><RiyalAmount amount={detail.sales_ytd} /></strong></span>
                  <span className="table-totals-item">{t("collected")} ({year}): <strong><RiyalAmount amount={detail.payments_ytd} /></strong></span>
                  <span className="table-totals-item">{t("recentTrend")}: <TrendIcon trend={detail.recent_trend} /></span>
                  <span className="table-totals-item">
                    <Clock size={12} style={{ verticalAlign: -2, marginInlineEnd: 3 }} />
                    {t("lastPaymentLabel")}: <strong>
                      {detail.last_payment_date ? `${fmtDate(detail.last_payment_date)} (${detail.days_since_last_payment} ${t("daysAgoSuffix")})` : t("neverPaidLabel")}
                    </strong>
                  </span>
                  {detail.aging_bucket && <span className="table-totals-item">{t("agingBucketLabel")}: <strong>{detail.aging_bucket}</strong></span>}
                  {detail.credit_utilization !== null && <span className="table-totals-item">{t("creditUtilization")}: <strong>{detail.credit_utilization}%</strong></span>}
                  {detail.other_credits_ytd !== 0 && (
                    <span className="table-totals-item" title={t("otherCreditsHint")}>
                      {t("otherCredits")} ({year}): <strong><RiyalAmount amount={detail.other_credits_ytd} /></strong>
                    </span>
                  )}
                </div>

                <div className="insights-chart-card" style={{ marginBottom: 20 }}>
                  <h3 className="insights-chart-title">{t("invoicedVsCollectedChart")} — {year}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={detailChartData}>
                      <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                             tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="sales" name={t("invoicedSales")} fill="#714b67" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="payments" name={t("collected")} fill="#30C381" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="other_credits" name={t("otherCredits")} fill="#c98a1c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>{t("recommendationsTitle")}</h3>
                <ul className="analysis-recommendations-list">
                  {detail.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("yearLabel")}</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("regionLabel")}</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("collectorField")}</label>
            <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {collectors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !overview && <div className="loading-state">{t("loadingDots")}</div>}

        {overview && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("invoicedSales")} ({year})</div>
                  <div className="insights-kpi-icon"><TrendingUp size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(overview.totals.sales)}</div>
              </div>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("collected")} ({year})</div>
                  <div className="insights-kpi-icon"><Wallet size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(overview.totals.payments)}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("customersCovered")}</div>
                  <div className="insights-kpi-icon"><BarChart3 size={15} /></div>
                </div>
                <div className="insights-kpi-value">{overview.totals.customers}</div>
              </div>
              <div className="insights-kpi-card accent-danger">
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("dormantBalances")}</div>
                  <div className="insights-kpi-icon"><AlertTriangle size={15} /></div>
                </div>
                <div className="insights-kpi-value insights-kpi-value-sm"><RiyalAmount amount={overview.dormant.balance} /></div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "4px 0 0" }}>{overview.dormant.count} {t("customersWord")}</p>
              </div>
            </div>

            {Object.keys(overview.aging_breakdown).length > 0 && (
              <div className="insights-chart-card" style={{ marginBottom: 20 }}>
                <h3 className="insights-chart-title">{t("agingBreakdownTitle")}</h3>
                <div className="table-totals-row" style={{ flexWrap: "wrap" }}>
                  {["1-30", "31-60", "61-90", "91-180", "180+", "never_paid"].filter((k) => overview.aging_breakdown[k]).map((k) => (
                    <span className="table-totals-item" key={k}>
                      {t(AGING_BUCKET_KEYS[k])}: <strong><RiyalAmount amount={overview.aging_breakdown[k].balance} /></strong> ({overview.aging_breakdown[k].count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="insights-chart-card" style={{ marginBottom: 20 }}>
              <h3 className="insights-chart-title">{t("invoicedVsCollectedChart")} — {year}</h3>
              <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "0 0 6px 6px" }}>{t("clickMonthHint")}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                         tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name={t("invoicedSales")} fill="#714b67" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }} onClick={openMonth} />
                  <Bar dataKey="payments" name={t("collected")} fill="#30C381" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }} onClick={openMonth} />
                  <Bar dataKey="other_credits" name={t("otherCredits")} fill="#c98a1c" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }} onClick={openMonth} />
                </BarChart>
              </ResponsiveContainer>
              {overview.totals.other_credits !== 0 && (
                <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: "8px 6px 0" }} title={t("otherCreditsHint")}>
                  {t("otherCredits")}: <RiyalAmount amount={overview.totals.other_credits} />
                </p>
              )}
            </div>

            <div className="quick-toggle-row" style={{ marginBottom: 10 }}>
              <button className={`quick-toggle-chip ${rankTab === "sales" ? "active" : ""}`} onClick={() => setRankTab("sales")}>{t("rankBySales")}</button>
              <button className={`quick-toggle-chip ${rankTab === "payments" ? "active" : ""}`} onClick={() => setRankTab("payments")}>{t("rankByPayments")}</button>
            </div>

            {ranked.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
            {ranked.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("customer")}</th>
                      <th>{t("regionLabel")}</th>
                      <th>{t("cityLabel")}</th>
                      <th>{t("collectorField")}</th>
                      <th>{t("invoicedSales")}</th>
                      <th>{t("collected")}</th>
                      <th>{t("balanceDue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r) => (
                      <tr key={r.partner_id}>
                        <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                          <span className="cust-name">{r.name}</span>
                        </td>
                        <td data-label={t("regionLabel")}>{r.region || "—"}</td>
                        <td data-label={t("cityLabel")}>{r.city || "—"}</td>
                        <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                        <td data-label={t("invoicedSales")}><RiyalAmount amount={r.sales} /></td>
                        <td data-label={t("collected")}><RiyalAmount amount={r.payments} /></td>
                        <td data-label={t("balanceDue")}>{r.current_due !== null ? <RiyalAmount amount={r.current_due} /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {monthDrilldown && (
        <div className="overlay modal-overlay" onClick={() => setMonthDrilldown(null)}>
          <div className="prompt-modal" style={{ maxWidth: 640, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setMonthDrilldown(null)}><X size={16} /></button>
            <h3>{monthDrilldown.label} {year}</h3>
            {monthError && <div className="error-state">{monthError}</div>}
            {!monthError && !monthRows && <div className="loading-state">{t("loadingDots")}</div>}
            {monthRows && monthRows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
            {monthRows && monthRows.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("customer")}</th>
                      <th>{t("cityLabel")}</th>
                      <th>{t("invoicedSales")}</th>
                      <th>{t("collected")}</th>
                      <th>{t("balanceDue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((r) => (
                      <tr key={r.partner_id}>
                        <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                          <span className="cust-name">{r.name}</span>
                        </td>
                        <td data-label={t("cityLabel")}>{r.city || "—"}</td>
                        <td data-label={t("invoicedSales")}>{r.invoiced ? <RiyalAmount amount={r.invoiced} /> : "—"}</td>
                        <td data-label={t("collected")}>{r.collected ? <RiyalAmount amount={r.collected} /> : "—"}</td>
                        <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
