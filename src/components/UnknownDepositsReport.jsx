import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, ArrowUp, ArrowDown, ArrowUpDown, Download, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const GROUP_MODES = ["none", "month"];

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null; // "YYYY-MM-DD" -> "YYYY-MM"
}

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
  const [expandedMonths, setExpandedMonths] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.unknownDepositsReport().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    setSortBy(groupBy === "month" ? "month" : "date");
    setSortDir("desc");
    setExpandedMonths(new Set());
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

  // Grouped client-side from the same flat list the "individual" view uses -
  // no separate request, so expanding a month to show its deposits is instant.
  const monthGroups = useMemo(() => {
    if (!data) return [];
    const byMonth = new Map();
    for (const r of data.results) {
      const key = monthKey(r.date);
      if (!byMonth.has(key)) byMonth.set(key, { month: key, count: 0, total_amount: 0, deposits: [] });
      const g = byMonth.get(key);
      g.count += 1;
      g.total_amount += r.amount || 0;
      g.deposits.push(r);
    }
    const groups = [...byMonth.values()];
    for (const g of groups) {
      g.deposits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    groups.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc" ? (av || "").localeCompare(bv || "") : (bv || "").localeCompare(av || "");
      }
      return sortDir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return groups;
  }, [data, sortBy, sortDir]);

  const toggleMonth = (key) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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
                {groupBy === "none" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th></th>
                        <th onClick={() => toggleSort("month")} style={{ cursor: "pointer" }}>{t("unknownDepositsMonthCol")}{sortIcon("month")}</th>
                        <th onClick={() => toggleSort("count")} style={{ cursor: "pointer" }}>{t("unknownDepositsSuffix")}{sortIcon("count")}</th>
                        <th onClick={() => toggleSort("total_amount")} style={{ cursor: "pointer" }}>{t("amount")}{sortIcon("total_amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthGroups.map((g) => {
                        const isOpen = expandedMonths.has(g.month);
                        return (
                          <Fragment key={g.month || "unassigned"}>
                            <tr style={{ cursor: "pointer" }} onClick={() => toggleMonth(g.month)}>
                              <td style={{ width: 24 }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                              <td>{monthLabel(g.month, lang) || t("debtAgingUnassignedLabel")}</td>
                              <td>{g.count}</td>
                              <td><RiyalAmount amount={g.total_amount} /></td>
                            </tr>
                            {isOpen && g.deposits.map((r) => (
                              <tr key={r.id} style={{ background: "var(--card)" }}>
                                <td></td>
                                <td colSpan={2} style={{ paddingInlineStart: 20 }}>
                                  <div>{r.date ? fmtDate(r.date) : "—"} · {r.payment_number || "—"}</div>
                                  <div className="settings-meta">{r.journal_name || "—"}{r.memo ? ` · ${r.memo}` : ""}</div>
                                </td>
                                <td><RiyalAmount amount={r.amount} /></td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                      {monthGroups.length === 0 && (
                        <tr><td colSpan={4} className="empty-state">{t("noResults")}</td></tr>
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
