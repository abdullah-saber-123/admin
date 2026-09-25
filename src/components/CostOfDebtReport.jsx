import { useEffect, useState, useCallback, useRef } from "react";
import { CircleDollarSign, Search, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

// Mirrors the backend's per-bucket math exactly, so an edit shows its effect
// immediately instead of waiting on a round trip - the debounced save below
// is just to persist it, not to compute the numbers shown on screen.
function computeDerived(amount, discountPct, returnPct, graceDays) {
  const discountCost = (amount * discountPct) / 100;
  const returnValue = (amount * returnPct) / 100;
  const targetCost = returnValue * (graceDays / 365);
  const breakevenDays = returnValue ? (discountCost / returnValue) * 365 : null;
  return {
    discount_cost: Math.round(discountCost * 100) / 100,
    return_on_capital_value: Math.round(returnValue * 100) / 100,
    target_cost: Math.round(targetCost * 100) / 100,
    breakeven_days: breakevenDays !== null ? Math.round(breakevenDays * 100) / 100 : null,
  };
}

export default function CostOfDebtReport({ role }) {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const isAdmin = role === "admin";
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editedBuckets, setEditedBuckets] = useState({});
  const [exportingPdf, setExportingPdf] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.fieldOptions("region").then((opts) => setRegions(opts.map((o) => o.value))).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.costOfDebtReport({
      city: cityFilter || "",
      region: regionFilter || "",
      collector: collectorFilter || "",
      partner_id: selectedClient?.partner_id || "",
    }).then((res) => {
      setData(res);
      setEditedBuckets(Object.fromEntries(res.buckets.map((b) => [b.bucket, {
        discount_percent: b.discount_percent,
        return_on_capital_percent: b.return_on_capital_percent,
        grace_period_days: b.grace_period_days,
      }])));
    }).catch((e) => setError(e.message));
  }, [cityFilter, regionFilter, collectorFilter, selectedClient]);

  useEffect(load, [load]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const updateBucketField = (bucket, field, value) => {
    setEditedBuckets((prev) => ({ ...prev, [bucket]: { ...prev[bucket], [field]: value } }));
    // Debounced auto-save - persists shortly after typing stops, no button
    // to click and no toast on every keystroke.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.saveCostOfDebtBucketSettings(
          Object.entries({ ...editedBuckets, [bucket]: { ...editedBuckets[bucket], [field]: value } }).map(([bk, v]) => ({
            bucket: bk,
            discount_percent: Number(v.discount_percent) || 0,
            return_on_capital_percent: Number(v.return_on_capital_percent) || 0,
            grace_period_days: Number(v.grace_period_days) || 0,
          }))
        );
      } catch (e) {
        showToast(e.message, "error");
      }
    }, 700);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await api.exportCostOfDebtPdf({
        city: cityFilter || "",
        region: regionFilter || "",
        collector: collectorFilter || "",
        partner_id: selectedClient?.partner_id || "",
        lang,
      });
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!clientSearch.trim()) { setClientOptions([]); return; }
    const timer = setTimeout(() => {
      api.customers({ search: clientSearch, page_size: 8 }).then((res) => setClientOptions(res.results || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const pickClient = (c) => {
    setSelectedClient(c);
    setClientSearch(c.name);
    setClientOptions([]);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
  };

  // Live buckets: the amount comes from the server, everything derived from
  // the discount/return/grace assumptions is recomputed from whatever's
  // currently in the edit fields (falling back to the server's own value
  // before any edit), so the table updates the instant you type.
  const liveBuckets = data ? data.buckets.map((b) => {
    const edited = editedBuckets[b.bucket] || {};
    const discountPct = Number(edited.discount_percent ?? b.discount_percent) || 0;
    const returnPct = Number(edited.return_on_capital_percent ?? b.return_on_capital_percent) || 0;
    const graceDays = Number(edited.grace_period_days ?? b.grace_period_days) || 0;
    return {
      ...b,
      discount_percent: discountPct,
      return_on_capital_percent: returnPct,
      grace_period_days: graceDays,
      ...computeDerived(b.current_amount || 0, discountPct, returnPct, graceDays),
    };
  }) : [];

  const liveSummary = (() => {
    if (!liveBuckets.length) return null;
    const totalAmount = liveBuckets.reduce((s, b) => s + (b.current_amount || 0), 0);
    const totalDiscountCost = liveBuckets.reduce((s, b) => s + b.discount_cost, 0);
    const totalReturnValue = liveBuckets.reduce((s, b) => s + b.return_on_capital_value, 0);
    return {
      total_discount_cost: Math.round(totalDiscountCost * 100) / 100,
      avg_discount_percent: totalAmount ? Math.round((totalDiscountCost / totalAmount) * 10000) / 100 : null,
      total_return_on_capital_value: Math.round(totalReturnValue * 100) / 100,
      avg_return_on_capital_percent: totalAmount ? Math.round((totalReturnValue / totalAmount) * 10000) / 100 : null,
    };
  })();

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><CircleDollarSign size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("costOfDebtTitle")}</h2>
            <p className="panel-sub">{t("costOfDebtReportHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exportingPdf || !data}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingPdf ? t("exporting") : t("print")}
          </button>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); clearClient(); }}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("regionLabel")}</label>
            <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); clearClient(); }}>
              <option value="">{t("allStatus")}</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field">
              <label>{t("collectorField")}</label>
              <select value={collectorFilter} onChange={(e) => { setCollectorFilter(e.target.value); clearClient(); }}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            {clientOptions.length > 0 && (
              <div className="client-search-dropdown">
                {clientOptions.map((c) => (
                  <button key={c.partner_id} type="button" onClick={() => pickClient(c)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>
                {selectedClient
                  ? selectedClient.name
                  : `${data.customer_count} ${t("customersSuffix")}`}
                :
              </span>
              <span className="table-totals-item"><strong><RiyalAmount amount={data.client_balance} /></strong></span>
            </div>

            {liveSummary && (
              <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
                <div className="insights-kpi-card accent-violet">
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t("codAvgDiscountLabel")}</div></div>
                  <div className="insights-kpi-value">{liveSummary.avg_discount_percent !== null ? `${liveSummary.avg_discount_percent}%` : "—"}</div>
                  <div className="my-day-city"><RiyalAmount amount={liveSummary.total_discount_cost} /></div>
                </div>
                <div className="insights-kpi-card accent-teal">
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t("codAvgReturnLabel")}</div></div>
                  <div className="insights-kpi-value">{liveSummary.avg_return_on_capital_percent !== null ? `${liveSummary.avg_return_on_capital_percent}%` : "—"}</div>
                  <div className="my-day-city"><RiyalAmount amount={liveSummary.total_return_on_capital_value} /></div>
                </div>
              </div>
            )}

            <div className="table-wrap">
              <table className="data-table cost-of-debt-table">
                <thead>
                  <tr>
                    <th>{t("codRow")}</th>
                    {liveBuckets.map((b) => (
                      <th key={b.bucket}>{t(`codBucket_${b.bucket}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t("codCurrentAmount")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>{b.current_amount ? <RiyalAmount amount={b.current_amount} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codDiscountPct")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>
                        {isAdmin ? (
                          <input
                            type="number" step="0.1" className="cost-of-debt-input"
                            value={editedBuckets[b.bucket]?.discount_percent ?? b.discount_percent}
                            onChange={(e) => updateBucketField(b.bucket, "discount_percent", e.target.value)}
                          />
                        ) : `${b.discount_percent}%`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codDiscountCost")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>{b.discount_cost ? <RiyalAmount amount={b.discount_cost} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codReturnPct")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>
                        {isAdmin ? (
                          <input
                            type="number" step="0.1" className="cost-of-debt-input"
                            value={editedBuckets[b.bucket]?.return_on_capital_percent ?? b.return_on_capital_percent}
                            onChange={(e) => updateBucketField(b.bucket, "return_on_capital_percent", e.target.value)}
                          />
                        ) : `${b.return_on_capital_percent}%`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codReturnValue")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>{b.return_on_capital_value ? <RiyalAmount amount={b.return_on_capital_value} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codGracePeriod")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>
                        {isAdmin ? (
                          <input
                            type="number" step="1" className="cost-of-debt-input"
                            value={editedBuckets[b.bucket]?.grace_period_days ?? b.grace_period_days}
                            onChange={(e) => updateBucketField(b.bucket, "grace_period_days", e.target.value)}
                          />
                        ) : b.grace_period_days}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codDaysOfYear")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>{b.days_of_year}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codTargetCost")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket}>{b.target_cost ? <RiyalAmount amount={b.target_cost} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codBreakeven")}</td>
                    {liveBuckets.map((b) => (
                      <td key={b.bucket} style={{ fontWeight: 700 }}>
                        {b.breakeven_days !== null ? <bdi>{b.breakeven_days}</bdi> : t("codDivZero")}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
