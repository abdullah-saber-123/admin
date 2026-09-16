import { useEffect, useState, useCallback } from "react";
import { CircleDollarSign, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function CostOfDebtReport() {
  const { t } = useLang();
  const [cities, setCities] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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
    }).then(setData).catch((e) => setError(e.message));
  }, [cityFilter, collectorFilter, selectedClient]);

  useEffect(load, [load]);

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
                      <td key={b.bucket}>{b.discount_percent}%</td>
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
                      <td key={b.bucket}>{b.return_on_capital_percent}%</td>
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
                      <td key={b.bucket}>{b.grace_period_days}</td>
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
          </>
        )}
      </div>
    </div>
  );
}
