import { useEffect, useState, useCallback } from "react";
import { Layers, Search, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

const BUCKETS = ["1-30", "31-60", "61-90", "90+", "never_paid"];
const GROUP_MODES = ["none", "city", "region", "collector"];
// The whole matching set is fetched in one go and rendered as a single
// continuously-scrolling table (no page-flip pagination) - a plain large
// cap here is simpler than infinite-scroll and comfortably covers the
// realistic size of this list (hundreds, not tens of thousands, of rows).
const ALL_ROWS_PAGE_SIZE = 50000;

export default function DebtAgingReport() {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const [groupBy, setGroupBy] = useState("none");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_balance");
  const [sortDir, setSortDir] = useState("desc");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.debtAgingReport({
      group_by: groupBy, search: groupBy === "none" ? search : "",
      sort_by: sortBy, sort_dir: sortDir, page: 1, page_size: ALL_ROWS_PAGE_SIZE,
    }).then(setData).catch((e) => setError(e.message));
  }, [groupBy, search, sortBy, sortDir]);

  useEffect(load, [load]);

  const exportParams = { group_by: groupBy, search: groupBy === "none" ? search : "", sort_by: sortBy, sort_dir: sortDir };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await api.debtAgingExportPdf({ ...exportParams, lang });
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await api.debtAgingExportExcel(exportParams);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  // Every sortable header shows an icon, not just the active one - a faint
  // two-way arrow hints "click me" on the rest, so sorting isn't discoverable
  // only by accident on whichever column happens to be the current sort.
  const sortIcon = (key) => {
    if (sortBy !== key) {
      return <ArrowUpDown size={12} style={{ verticalAlign: -1, marginInlineStart: 3, opacity: 0.35 }} />;
    }
    const Icon = sortDir === "desc" ? ArrowDown : ArrowUp;
    return <Icon size={12} style={{ verticalAlign: -1, marginInlineStart: 3 }} />;
  };

  const groupLabel = (row) => row.group || t("debtAgingUnassignedLabel");

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Layers size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("debtAgingReportTitle")}</h2>
            <p className="panel-sub">{t("debtAgingReportHint")}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exporting || !data || data.rows.length === 0}>
              <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {exporting ? t("exporting") : t("exportPdfButton")}
            </button>
            <button className="btn-secondary sm" onClick={handleExportExcel} disabled={exporting || !data || data.rows.length === 0}>
              <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {exporting ? t("exporting") : t("exportExcelButton")}
            </button>
          </div>
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

            {groupBy === "none" && (
              <div className="table-totals-row" style={{ marginTop: 10 }}>
                <span><bdi>{data.total_rows}</bdi> {t("customersSuffix")}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
