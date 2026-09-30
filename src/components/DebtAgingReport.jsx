import { useEffect, useState, useCallback } from "react";
import { Layers, Search, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

const BUCKETS = ["1-30", "31-60", "61-90", "90+", "never_paid"];
const GROUP_MODES = ["none", "city", "region", "collector"];

export default function DebtAgingReport() {
  const { t } = useLang();
  const [groupBy, setGroupBy] = useState("none");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_balance");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const pageSize = 50;

  const load = useCallback(() => {
    setError(null);
    api.debtAgingReport({
      group_by: groupBy, search: groupBy === "none" ? search : "",
      sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize,
    }).then(setData).catch((e) => setError(e.message));
  }, [groupBy, search, sortBy, sortDir, page]);

  useEffect(load, [load]);

  // Any filter/grouping change should land back on page 1 - staying on page 4
  // of a now-much-shorter (or differently sorted) list would just show empty rows.
  useEffect(() => { setPage(1); }, [groupBy, search, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const sortIcon = (key) => {
    if (sortBy !== key) return null;
    const Icon = sortDir === "desc" ? ArrowDown : ArrowUp;
    return <Icon size={12} style={{ verticalAlign: -1, marginInlineStart: 3 }} />;
  };

  const groupLabel = (row) => row.group || t("debtAgingUnassignedLabel");

  const totalPages = data ? Math.max(1, Math.ceil(data.total_rows / pageSize)) : 1;

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
          {groupBy === "none" && (
            <div className="more-filter-field" style={{ position: "relative" }}>
              <label>{t("customer")}</label>
              <div className="input-icon compact">
                <Search size={13} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                />
              </div>
            </div>
          )}
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
                    <th onClick={() => toggleSort(groupBy === "none" ? "name" : "group")} style={{ cursor: "pointer" }}>
                      {groupBy === "none" ? t("customer") : t(`debtAgingViewBy_${groupBy}`)}
                      {sortIcon(groupBy === "none" ? "name" : "group")}
                    </th>
                    {BUCKETS.map((b) => (
                      <th key={b} onClick={() => toggleSort(b)} style={{ cursor: "pointer" }}>
                        {t(`debtAgingBucket_${b}`)}{sortIcon(b)}
                      </th>
                    ))}
                    <th onClick={() => toggleSort("total_balance")} style={{ cursor: "pointer" }}>
                      {t("debtAgingTotalCol")}{sortIcon("total_balance")}
                    </th>
                    {groupBy !== "none" && <th>{t("debtAgingCustomersCol")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={groupBy === "none" ? row.partner_id : (row.group || "unassigned")}>
                      <td>{groupLabel(row)}</td>
                      {BUCKETS.map((b) => (
                        <td key={b}>{row.buckets[b] ? <RiyalAmount amount={row.buckets[b].balance} /> : "—"}</td>
                      ))}
                      <td style={{ fontWeight: 700 }}><RiyalAmount amount={row.total_balance} /></td>
                      {groupBy !== "none" && <td>{row.total_customers}</td>}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr><td colSpan={BUCKETS.length + 2} className="empty-state">{t("noResults")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {groupBy === "none" && totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
                <span className="page-info"><bdi>{page} / {totalPages} · {data.total_rows}</bdi> {t("customersSuffix")}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
