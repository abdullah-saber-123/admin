import { useEffect, useState } from "react";
import { GitCompare, Search, X } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import RiskBadge from "./RiskBadge.jsx";

const GRADE_TONE = { A: "ok", B: "teal", C: "warn", D: "danger" };
const MAX_CUSTOMERS = 5;

function bestIndex(values, direction) {
  let best = -1;
  values.forEach((v, i) => {
    if (v == null) return;
    if (best === -1) { best = i; return; }
    if (direction === "higher" ? v > values[best] : v < values[best]) best = i;
  });
  return best;
}

export default function CustomerComparisonReport() {
  const { t, money } = useLang();

  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientSearch.trim()) { setClientOptions([]); return; }
    const timer = setTimeout(() => {
      api.customers({ search: clientSearch, page_size: 8 }).then((res) => setClientOptions(res.results || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    if (selected.length === 0) { setData(null); return; }
    setLoading(true);
    setError(null);
    const partnerIds = selected.map((c) => c.partner_id);
    api.customerComparison(partnerIds, { dateFrom, dateTo })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, dateFrom, dateTo]);

  const addCustomer = (c) => {
    if (selected.some((s) => s.partner_id === c.partner_id)) return;
    if (selected.length >= MAX_CUSTOMERS) return;
    setSelected([...selected, c]);
    setClientSearch("");
    setClientOptions([]);
  };

  const removeCustomer = (partnerId) => {
    setSelected(selected.filter((s) => s.partner_id !== partnerId));
  };

  const rows = data?.customers || [];
  const usingCustomPeriod = !!(dateFrom || dateTo);

  const metricRows = rows.length > 0 ? [
    { key: "city", label: t("cityLabel"), render: (r) => r.city || "—" },
    { key: "collector", label: t("collectorField"), render: (r) => r.collector || "—" },
    { key: "payment_type", label: t("paymentTypeLabel"), render: (r) => r.payment_type || "—" },
    { key: "status", label: t("status"), render: (r) => <span className={`status-tag ${r.status}`}>{r.status}</span> },
    {
      key: "balance", label: usingCustomPeriod ? t("comparisonBalanceAsOf") : t("balanceDue"),
      render: (r) => <RiyalAmount amount={usingCustomPeriod ? r.balance_as_of : r.current_balance} />,
      values: rows.map((r) => (usingCustomPeriod ? r.balance_as_of : r.current_balance)), direction: "lower",
    },
    {
      key: "risk_level", label: t("riskLevel"), render: (r) => <RiskBadge level={r.risk_level} />,
    },
    {
      key: "score", label: t("scoreLabel"),
      render: (r) => (
        <span>
          <bdi style={{ fontWeight: 700 }}>{r.score}</bdi>{" "}
          <span className={`fu-tag ${GRADE_TONE[r.grade]}`}>{r.grade}</span>
        </span>
      ),
      values: rows.map((r) => r.score), direction: "higher",
    },
    {
      key: "overdue_amount", label: t("overdueAmount"),
      render: (r) => <RiyalAmount amount={r.overdue_amount} />,
      values: rows.map((r) => r.overdue_amount), direction: "lower",
    },
    { key: "max_days_overdue", label: t("maxDaysOverdueLabel"), render: (r) => r.max_days_overdue ?? "—", values: rows.map((r) => r.max_days_overdue), direction: "lower" },
    { key: "days_since_last_payment", label: t("daysSinceLastPayment"), render: (r) => r.days_since_last_payment ?? "—", values: rows.map((r) => r.days_since_last_payment), direction: "lower" },
    { key: "last_payment", label: t("lastPaymentLabel"), render: (r) => r.last_payment_date ? `${fmtDate(r.last_payment_date)} · ${money(r.last_payment_amount)}` : "—" },
    { key: "escalations_count", label: t("escalationsCountLabel"), render: (r) => r.escalations_count, values: rows.map((r) => r.escalations_count), direction: "lower" },
    { key: "credit_limit", label: t("creditLimitLabel"), render: (r) => r.credit_limit ? <RiyalAmount amount={r.credit_limit} /> : "—" },
    {
      key: "period_sales", label: t("comparisonPeriodSales"),
      render: (r) => <RiyalAmount amount={r.period_sales} />,
      values: rows.map((r) => r.period_sales), direction: "higher",
    },
    { key: "period_returns", label: t("comparisonPeriodReturns"), render: (r) => <RiyalAmount amount={r.period_returns} /> },
    {
      key: "period_net_sales", label: t("comparisonPeriodNetSales"),
      render: (r) => <RiyalAmount amount={r.period_net_sales} />,
      values: rows.map((r) => r.period_net_sales), direction: "higher",
    },
    { key: "period_invoice_count", label: t("comparisonPeriodInvoiceCount"), render: (r) => r.period_invoice_count },
    {
      key: "period_payments", label: t("comparisonPeriodPayments"),
      render: (r) => <RiyalAmount amount={r.period_payments} />,
      values: rows.map((r) => r.period_payments), direction: "higher",
    },
  ] : [];

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><GitCompare size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("comparisonTitle")}</h2>
        <p className="panel-sub">{t("comparisonHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 10 }}>
          <div className="more-filter-field" style={{ position: "relative", minWidth: 280 }}>
            <label>{t("comparisonAddCustomer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                disabled={selected.length >= MAX_CUSTOMERS}
              />
            </div>
            {clientOptions.length > 0 && (
              <div className="client-search-dropdown">
                {clientOptions.map((c) => (
                  <button key={c.partner_id} type="button" onClick={() => addCustomer(c)} disabled={selected.some((s) => s.partner_id === c.partner_id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="more-filter-field">
            <label>{t("discountDateFrom")}</label>
            <input className="cost-of-debt-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="more-filter-field">
            <label>{t("discountDateTo")}</label>
            <input className="cost-of-debt-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="quick-toggle-row" style={{ marginBottom: 14 }}>
            {selected.map((c) => (
              <span key={c.partner_id} className="quick-toggle-chip active" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.name}
                <button className="icon-btn" onClick={() => removeCustomer(c.partner_id)}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        {selected.length === 0 && <div className="empty-state">{t("comparisonEmptyState")}</div>}
        {error && <div className="error-state">{error}</div>}
        {loading && <div className="loading-state">{t("loadingDots")}</div>}

        {!loading && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  {rows.map((r) => <th key={r.partner_id}>{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {metricRows.map((m) => {
                  const highlightIdx = m.values ? bestIndex(m.values, m.direction) : -1;
                  return (
                    <tr key={m.key}>
                      <td style={{ fontWeight: 600, color: "var(--text-dim)" }}>{m.label}</td>
                      {rows.map((r, i) => (
                        <td key={r.partner_id} style={i === highlightIdx ? { background: "var(--ok-soft)", borderRadius: 6 } : undefined}>
                          {m.render(r)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
