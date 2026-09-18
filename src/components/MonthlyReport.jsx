import { useEffect, useState, Fragment } from "react";
import { CalendarRange, ChevronDown, ChevronUp, Search, X, TrendingUp, Wallet, Target, Award } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";
import percentIconSvg from "../assets/icons/percent.svg";

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};

function monthLabel(m, lang) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long" });
}

function monthLabelShort(m, lang) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "2-digit", month: "short" });
}

export default function MonthlyReport({ onSelectCustomer }) {
  const { t, lang, money } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [customerRows, setCustomerRows] = useState(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // { partner_id, name }
  const [customerReport, setCustomerReport] = useState(null);

  useEffect(() => {
    api.monthlyReport(12).then((data) => setRows([...data].reverse())).catch((e) => setError(e.message));
  }, []);

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
    setCustomerReport(null);
    api.monthlyReportForCustomer(c.partner_id, 12).then(setCustomerReport).catch(() => setCustomerReport({ months: [] }));
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerReport(null);
  };

  const toggleMonth = (m) => {
    if (expandedMonth === m) {
      setExpandedMonth(null);
      setCustomerRows(null);
      return;
    }
    setExpandedMonth(m);
    setCustomerRows(null);
    api.monthlyReportCustomers(m).then(setCustomerRows).catch(() => setCustomerRows([]));
  };

  const totals = rows
    ? rows.reduce((acc, r) => ({
        invoiced: acc.invoiced + r.invoiced, collected: acc.collected + r.collected,
        other_credits: acc.other_credits + (r.other_credits || 0),
      }), { invoiced: 0, collected: 0, other_credits: 0 })
    : null;

  const avgRate = rows && rows.length > 0
    ? rows.filter((r) => r.collection_rate !== null).reduce((s, r, _, arr) => s + r.collection_rate / arr.length, 0)
    : null;
  const bestMonth = rows && rows.length > 0 ? [...rows].sort((a, b) => b.collected - a.collected)[0] : null;

  const chartData = rows ? [...rows].reverse().map((r) => ({ label: monthLabelShort(r.month, lang), invoiced: r.invoiced, collected: r.collected })) : [];

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><CalendarRange size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("monthlyReportTitle")}</h2>
        <p className="panel-sub">{t("monthlyReportHint")}</p>

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
              <h3 style={{ margin: 0, fontSize: 15 }}>
                {t("monthlyHistoryFor")}: <span className="cust-name" style={{ cursor: "pointer", color: "var(--primary)" }} onClick={() => onSelectCustomer?.(selectedCustomer.partner_id)}>{selectedCustomer.name}</span>
              </h3>
              <button className="icon-btn" onClick={clearCustomer} title={t("cancel")}><X size={15} /></button>
            </div>
            {!customerReport && <div className="loading-state">{t("loadingDots")}</div>}
            {customerReport && customerReport.months.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
            {customerReport && customerReport.months.length > 0 && (
              <>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 10px" }}>
                  {t("balanceDue")}: <strong><RiyalAmount amount={customerReport.current_balance} /></strong>
                  {customerReport.months.reduce((s, m) => s + (m.other_credits || 0), 0) !== 0 && (
                    <span title={t("otherCreditsHint")} style={{ marginInlineStart: 14 }}>
                      {t("otherCredits")}: <strong><RiyalAmount amount={customerReport.months.reduce((s, m) => s + (m.other_credits || 0), 0)} /></strong>
                    </span>
                  )}
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("month")}</th>
                        <th>{t("invoicedSales")}</th>
                        <th>{t("collected")}</th>
                        <th>{t("collectionRate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...customerReport.months].reverse().map((m) => (
                        <tr key={m.month}>
                          <td><strong>{monthLabel(m.month, lang)}</strong></td>
                          <td><RiyalAmount amount={m.invoiced} /></td>
                          <td><RiyalAmount amount={m.collected} /></td>
                          <td>
                            {m.collection_rate !== null ? (
                              <span className={`fu-tag ${m.collection_rate >= 80 ? "ok" : m.collection_rate >= 50 ? "warn" : "danger"}`}>
                                {m.collection_rate}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && rows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {totals && rows.length > 0 && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-violet">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("invoicedSales")}</div>
                  <div className="insights-kpi-icon"><TrendingUp size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(totals.invoiced)}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-teal">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("collected")}</div>
                  <div className="insights-kpi-icon"><Wallet size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(totals.collected)}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-amber">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("avgCollectionRate")}</div>
                  <div className="insights-kpi-icon"><Target size={15} /></div>
                </div>
                <div className="insights-kpi-value">{avgRate !== null ? `${avgRate.toFixed(1)}%` : "—"}</div>
                <div className="insights-kpi-bar" />
              </div>
              <div className="insights-kpi-card accent-danger">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("bestMonth")}</div>
                  <div className="insights-kpi-icon"><Award size={15} /></div>
                </div>
                <div className="insights-kpi-value insights-kpi-value-sm">{bestMonth ? monthLabel(bestMonth.month, lang) : "—"}</div>
              </div>
            </div>

            <div className="insights-chart-card" style={{ marginBottom: 20 }}>
              <h3 className="insights-chart-title">{t("invoicedVsCollectedChart")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                         tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="invoiced" name={t("invoicedSales")} fill="#714b67" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name={t("collected")} fill="#30C381" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-totals-row" style={{ marginBottom: 14 }}>
              <span className="table-totals-item">{t("last12MonthsTotal")}:</span>
              <span className="table-totals-item">{t("invoicedSales")}: <strong><RiyalAmount amount={totals.invoiced} /></strong></span>
              <span className="table-totals-item">{t("collected")}: <strong><RiyalAmount amount={totals.collected} /></strong></span>
              {totals.other_credits !== 0 && (
                <span className="table-totals-item" title={t("otherCreditsHint")}>
                  {t("otherCredits")}: <strong><RiyalAmount amount={totals.other_credits} /></strong>
                </span>
              )}
            </div>
          </>
        )}

        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{t("month")}</th>
                  <th>{t("invoicedSales")}</th>
                  <th>{t("collected")}</th>
                  <th>
                    <img src={percentIconSvg} alt="" style={{ width: 12, height: 12, verticalAlign: -1, marginInlineEnd: 4 }} />
                    {t("collectionRate")}
                  </th>
                  <th>{t("billedCustomers")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.month}>
                    <tr className="clickable-row" onClick={() => toggleMonth(r.month)}>
                      <td style={{ width: 24 }}>{expandedMonth === r.month ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      <td data-label={t("month")}><strong>{monthLabel(r.month, lang)}</strong></td>
                      <td data-label={t("invoicedSales")}><RiyalAmount amount={r.invoiced} /></td>
                      <td data-label={t("collected")}><RiyalAmount amount={r.collected} /></td>
                      <td data-label={t("collectionRate")}>
                        {r.collection_rate !== null ? (
                          <span className={`fu-tag ${r.collection_rate >= 80 ? "ok" : r.collection_rate >= 50 ? "warn" : "danger"}`}>
                            {r.collection_rate}%
                          </span>
                        ) : "—"}
                      </td>
                      <td data-label={t("billedCustomers")}>{r.billed_customers}</td>
                    </tr>
                    {expandedMonth === r.month && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: "var(--card)" }}>
                          <div style={{ padding: 14 }}>
                            {!customerRows && <div className="loading-state">{t("loadingDots")}</div>}
                            {customerRows && customerRows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
                            {customerRows && customerRows.length > 0 && (
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
                                    {customerRows.map((cr) => (
                                      <tr key={cr.partner_id}>
                                        <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(cr.partner_id)}>
                                          <span className="cust-name">{cr.name}</span>
                                        </td>
                                        <td data-label={t("cityLabel")}>{cr.city || "—"}</td>
                                        <td data-label={t("invoicedSales")}>{cr.invoiced ? <RiyalAmount amount={cr.invoiced} /> : "—"}</td>
                                        <td data-label={t("collected")}>{cr.collected ? <RiyalAmount amount={cr.collected} /> : "—"}</td>
                                        <td data-label={t("balanceDue")}><RiyalAmount amount={cr.current_balance} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
