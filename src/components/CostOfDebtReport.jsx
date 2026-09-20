import { useEffect, useState, useCallback } from "react";
import { CircleDollarSign, Search, Save } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function CostOfDebtReport({ role }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const isAdmin = role === "admin";
  const [cities, setCities] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editedBuckets, setEditedBuckets] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.costOfDebtReport({
      city: cityFilter || "",
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
  }, [cityFilter, collectorFilter, selectedClient]);

  useEffect(load, [load]);

  const updateBucketField = (bucket, field, value) => {
    setEditedBuckets((prev) => ({ ...prev, [bucket]: { ...prev[bucket], [field]: value } }));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.saveCostOfDebtBucketSettings(
        Object.entries(editedBuckets).map(([bucket, v]) => ({
          bucket,
          discount_percent: Number(v.discount_percent) || 0,
          return_on_capital_percent: Number(v.return_on_capital_percent) || 0,
          grace_period_days: Number(v.grace_period_days) || 0,
        }))
      );
      showToast(t("exportReady"), "success");
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingSettings(false);
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

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><CircleDollarSign size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("costOfDebtTitle")}</h2>
        <p className="panel-sub">{t("costOfDebtReportHint")}</p>

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

            {data.summary && (
              <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
                <div className="insights-kpi-card accent-violet">
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t("codAvgDiscountLabel")}</div></div>
                  <div className="insights-kpi-value">{data.summary.avg_discount_percent !== null ? `${data.summary.avg_discount_percent}%` : "—"}</div>
                  <div className="my-day-city"><RiyalAmount amount={data.summary.total_discount_cost} /></div>
                </div>
                <div className="insights-kpi-card accent-teal">
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t("codAvgReturnLabel")}</div></div>
                  <div className="insights-kpi-value">{data.summary.avg_return_on_capital_percent !== null ? `${data.summary.avg_return_on_capital_percent}%` : "—"}</div>
                  <div className="my-day-city"><RiyalAmount amount={data.summary.total_return_on_capital_value} /></div>
                </div>
              </div>
            )}

            <div className="table-wrap">
              <table className="data-table cost-of-debt-table">
                <thead>
                  <tr>
                    <th>{t("codRow")}</th>
                    {data.buckets.map((b) => (
                      <th key={b.bucket}>{t(`codBucket_${b.bucket}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t("codCurrentAmount")}</td>
                    {data.buckets.map((b) => (
                      <td key={b.bucket}>{b.current_amount ? <RiyalAmount amount={b.current_amount} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codDiscountPct")}</td>
                    {data.buckets.map((b) => (
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
                    {data.buckets.map((b) => (
                      <td key={b.bucket}>{b.discount_cost ? <RiyalAmount amount={b.discount_cost} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codReturnPct")}</td>
                    {data.buckets.map((b) => (
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
                    {data.buckets.map((b) => (
                      <td key={b.bucket}>{b.return_on_capital_value ? <RiyalAmount amount={b.return_on_capital_value} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codGracePeriod")}</td>
                    {data.buckets.map((b) => (
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
                    {data.buckets.map((b) => (
                      <td key={b.bucket}>{b.days_of_year}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codTargetCost")}</td>
                    {data.buckets.map((b) => (
                      <td key={b.bucket}>{b.target_cost ? <RiyalAmount amount={b.target_cost} /> : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t("codBreakeven")}</td>
                    {data.buckets.map((b) => (
                      <td key={b.bucket} style={{ fontWeight: 700 }}>
                        {b.breakeven_days !== null ? <bdi>{b.breakeven_days}</bdi> : t("codDivZero")}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <button className="btn-primary sm" onClick={handleSaveSettings} disabled={savingSettings} style={{ marginTop: 12 }}>
                <Save size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {savingSettings ? t("saving") : t("save")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
