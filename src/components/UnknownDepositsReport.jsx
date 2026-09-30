import { useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function UnknownDepositsReport() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const load = useCallback(() => {
    setError(null);
    api.unknownDepositsReport().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "amount" || key === "date" ? "desc" : "asc");
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
        <div>
          <h2><Banknote size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("unknownDepositsTitle")}</h2>
          <p className="panel-sub">{t("unknownDepositsHint")}</p>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 14, marginBottom: 14 }}>
              <span>{data.count} {t("unknownDepositsSuffix")}</span>
              <span className="table-totals-item"><strong><RiyalAmount amount={data.total_amount} /></strong></span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>{t("date")}{sortIcon("date")}</th>
                    <th onClick={() => toggleSort("payment_number")} style={{ cursor: "pointer" }}>{t("unknownDepositsNumberCol")}{sortIcon("payment_number")}</th>
                    <th onClick={() => toggleSort("journal_name")} style={{ cursor: "pointer" }}>{t("unknownDepositsJournalCol")}{sortIcon("journal_name")}</th>
                    <th onClick={() => toggleSort("memo")} style={{ cursor: "pointer" }}>{t("unknownDepositsMemoCol")}{sortIcon("memo")}</th>
                    <th onClick={() => toggleSort("amount")} style={{ cursor: "pointer" }}>{t("amount")}{sortIcon("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date ? fmtDate(r.date) : "—"}</td>
                      <td>{r.payment_number || "—"}</td>
                      <td>{r.journal_name || "—"}</td>
                      <td>{r.memo || "—"}</td>
                      <td><RiyalAmount amount={r.amount} /></td>
                    </tr>
                  ))}
                  {sortedResults.length === 0 && (
                    <tr><td colSpan={5} className="empty-state">{t("noResults")}</td></tr>
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
