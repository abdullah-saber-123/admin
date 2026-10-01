import { useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const GROUP_MODES = ["none", "month"];

function monthLabel(key, lang) {
  if (!key) return null;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(lang === "ar" ? "ar" : "en", { year: "numeric", month: "long" });
}

export default function UnknownDepositsReport() {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const [groupBy, setGroupBy] = useState("none");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.unknownDepositsReport({ group_by: groupBy }).then(setData).catch((e) => setError(e.message));
  }, [groupBy]);

  useEffect(load, [load]);

  useEffect(() => {
    setSortBy(groupBy === "month" ? "month" : "date");
    setSortDir("desc");
  }, [groupBy]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await api.unknownDepositsExportPdf(lang);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "amount" || key === "date" || key === "month" || key === "count" ? "desc" : "asc");
    }
  };

  // Every sortable header shows an icon, not just the active one - a faint
  // two-way arrow hints "click me" on the rest, same pattern used elsewhere.
  const sortIcon = (key) => {
    if (sortBy !== key) {
      return <ArrowUpDown size={12} style={{ verticalAlign: -1, marginInlineStart: 3, opacity: 0.35 }} />;
    }
    const Icon = sortDir === "asc" ? ArrowUp : ArrowDown;
    return <Icon size={12} style={{ verticalAlign: -1, marginInlineStart: 3 }} />;
  };

  const sortedResults = useMemo(() => {
    if (!data) return [];
    const rows = [...data.results];
    rows.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc" ? (av || "").localeCompare(bv || "") : (bv || "").localeCompare(av || "");
      }
      return sortDir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return rows;
  }, [data, sortBy, sortDir]);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Banknote size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("unknownDepositsTitle")}</h2>
            <p className="panel-sub">{t("unknownDepositsHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exporting || !data || data.count === 0}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exporting ? t("exporting") : t("print")}
          </button>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("debtAgingViewByLabel")}</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {GROUP_MODES.map((m) => (
                <option key={m} value={m}>{t(`unknownDepositsGroupBy_${m}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{data.count} {t("unknownDepositsSuffix")}</span>
              <span className="table-totals-item"><strong><RiyalAmount amount={data.total_amount} /></strong></span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  {groupBy === "none" ? (
                    <tr>
                      <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>{t("date")}{sortIcon("date")}</th>
                      <th onClick={() => toggleSort("payment_number")} style={{ cursor: "pointer" }}>{t("unknownDepositsNumberCol")}{sortIcon("payment_number")}</th>
                      <th onClick={() => toggleSort("journal_name")} style={{ cursor: "pointer" }}>{t("unknownDepositsJournalCol")}{sortIcon("journal_name")}</th>
                      <th onClick={() => toggleSort("memo")} style={{ cursor: "pointer" }}>{t("unknownDepositsMemoCol")}{sortIcon("memo")}</th>
                      <th onClick={() => toggleSort("amount")} style={{ cursor: "pointer" }}>{t("amount")}{sortIcon("amount")}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th onClick={() => toggleSort("month")} style={{ cursor: "pointer" }}>{t("unknownDepositsMonthCol")}{sortIcon("month")}</th>
                      <th onClick={() => toggleSort("count")} style={{ cursor: "pointer" }}>{t("unknownDepositsSuffix")}{sortIcon("count")}</th>
                      <th onClick={() => toggleSort("total_amount")} style={{ cursor: "pointer" }}>{t("amount")}{sortIcon("total_amount")}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {groupBy === "none" ? sortedResults.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date ? fmtDate(r.date) : "—"}</td>
                      <td>{r.payment_number || "—"}</td>
                      <td>{r.journal_name || "—"}</td>
                      <td>{r.memo || "—"}</td>
                      <td><RiyalAmount amount={r.amount} /></td>
                    </tr>
                  )) : sortedResults.map((r) => (
                    <tr key={r.month || "unassigned"}>
                      <td>{monthLabel(r.month, lang) || t("debtAgingUnassignedLabel")}</td>
                      <td>{r.count}</td>
                      <td><RiyalAmount amount={r.total_amount} /></td>
                    </tr>
                  ))}
                  {sortedResults.length === 0 && (
                    <tr><td colSpan={groupBy === "none" ? 5 : 3} className="empty-state">{t("noResults")}</td></tr>
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
