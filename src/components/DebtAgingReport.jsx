import { useEffect, useState, useCallback } from "react";
import { Layers } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

const BUCKETS = ["1-30", "31-60", "61-90", "90+", "never_paid"];
const GROUP_MODES = ["none", "city", "region", "collector"];

export default function DebtAgingReport() {
  const { t } = useLang();
  const [groupBy, setGroupBy] = useState("none");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.debtAgingReport(groupBy).then(setData).catch((e) => setError(e.message));
  }, [groupBy]);

  useEffect(load, [load]);

  const groupLabel = (row) => {
    if (groupBy === "none") return t("debtAgingOverallLabel");
    return row.group || t("debtAgingUnassignedLabel");
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div>
          <h2><Layers size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("debtAgingReportTitle")}</h2>
          <p className="panel-sub">{t("debtAgingReportHint")}</p>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("debtAgingViewByLabel")}</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {GROUP_MODES.map((m) => (
                <option key={m} value={m}>{t(`debtAgingViewBy_${m}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              {BUCKETS.map((b) => (
                <div key={b} className={`insights-kpi-card ${b === "never_paid" || b === "90+" ? "accent-danger" : "accent-violet"}`}>
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t(`debtAgingBucket_${b}`)}</div></div>
                  <div className="insights-kpi-value"><RiyalAmount amount={data.bucket_totals[b] || 0} /></div>
                </div>
              ))}
            </div>

            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{t("debtAgingGrandTotal")}:</span>
              <span className="table-totals-item"><strong><RiyalAmount amount={data.grand_total} /></strong></span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{groupBy === "none" ? t("debtAgingOverallLabel") : t(`debtAgingViewBy_${groupBy}`)}</th>
                    {BUCKETS.map((b) => (
                      <th key={b}>{t(`debtAgingBucket_${b}`)}</th>
                    ))}
                    <th>{t("debtAgingTotalCol")}</th>
                    <th>{t("debtAgingCustomersCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.group || "overall"}>
                      <td>{groupLabel(row)}</td>
                      {BUCKETS.map((b) => (
                        <td key={b}>{row.buckets[b] ? <RiyalAmount amount={row.buckets[b].balance} /> : "—"}</td>
                      ))}
                      <td style={{ fontWeight: 700 }}><RiyalAmount amount={row.total_balance} /></td>
                      <td>{row.total_customers}</td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr><td colSpan={BUCKETS.length + 3} className="empty-state">{t("noResults")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
