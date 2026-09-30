import { useEffect, useState, useCallback, useMemo } from "react";
import { Link2Off, Copy, Check, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function UnmatchedCustomerPaymentsReport() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sortBy, setSortBy] = useState("unmatched_debit");
  const [sortDir, setSortDir] = useState("desc");

  const load = useCallback(() => {
    setError(null);
    api.unmatchedCustomerPaymentsReport().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const copyName = (row) => {
    navigator.clipboard?.writeText(row.name).then(() => {
      setCopiedId(row.partner_id);
      setTimeout(() => setCopiedId((id) => (id === row.partner_id ? null : id)), 1500);
    });
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "name" || key === "collector" || key === "city" ? "asc" : "desc");
    }
  };

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
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv || "") : (bv || "").localeCompare(av);
      return sortDir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return rows;
  }, [data, sortBy, sortDir]);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div>
          <h2><Link2Off size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("unmatchedPaymentsTitle")}</h2>
          <p className="panel-sub">{t("unmatchedPaymentsHint")}</p>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{data.results.length} {t("customersSuffix")}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>{t("customer")}{sortIcon("name")}</th>
                    <th onClick={() => toggleSort("collector")} style={{ cursor: "pointer" }}>{t("collectorField")}{sortIcon("collector")}</th>
                    <th onClick={() => toggleSort("city")} style={{ cursor: "pointer" }}>{t("cityLabel")}{sortIcon("city")}</th>
                    <th onClick={() => toggleSort("unmatched_debit")} style={{ cursor: "pointer" }}>{t("unmatchedPaymentsDebitCol")}{sortIcon("unmatched_debit")}</th>
                    <th onClick={() => toggleSort("unmatched_credit")} style={{ cursor: "pointer" }}>{t("unmatchedPaymentsCreditCol")}{sortIcon("unmatched_credit")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r) => (
                    <tr key={r.partner_id}>
                      <td>{r.name}</td>
                      <td>{r.collector || "—"}</td>
                      <td>{r.city || "—"}</td>
                      <td><RiyalAmount amount={r.unmatched_debit} /></td>
                      <td><RiyalAmount amount={r.unmatched_credit} /></td>
                      <td>
                        <button className="btn-secondary sm" onClick={() => copyName(r)} title={t("unmatchedPaymentsCopyName")}>
                          {copiedId === r.partner_id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedResults.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">{t("noResults")}</td></tr>
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
