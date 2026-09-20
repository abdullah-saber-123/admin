import { useEffect, useState, useCallback } from "react";
import { Gauge, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

const GRADE_TONE = { A: "ok", B: "teal", C: "warn", D: "danger" };

function ScoreBar({ score }) {
  const color = score >= 80 ? "#17974a" : score >= 60 ? "#0f9c8c" : score >= 40 ? "#c98a1c" : "#e5484d";
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

export default function CustomerScoreReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState("asc");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.fieldOptions("payment_type").then(setPaymentTypeOptions).catch(() => {}); }, []);

  const load = useCallback(() => {
    setError(null);
    api.customerScores({ search, grade: gradeFilter, payment_type: paymentTypeFilter || null }).then(setRows).catch((e) => setError(e.message));
  }, [search, gradeFilter, paymentTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const sortedRows = rows ? [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = (a.name || "").localeCompare(b.name || "", "ar");
    else if (sortBy === "collector") cmp = (a.collector || "").localeCompare(b.collector || "", "ar");
    else if (sortBy === "current_due") cmp = (a.current_due || 0) - (b.current_due || 0);
    else if (sortBy === "payment_type") cmp = (a.payment_type || "").localeCompare(b.payment_type || "", "ar");
    else if (sortBy === "score") cmp = a.score - b.score;
    else if (sortBy === "grade") cmp = (a.grade || "").localeCompare(b.grade || "");
    return sortDir === "asc" ? cmp : -cmp;
  }) : null;

  const counts = rows
    ? { A: rows.filter((r) => r.grade === "A").length, B: rows.filter((r) => r.grade === "B").length, C: rows.filter((r) => r.grade === "C").length, D: rows.filter((r) => r.grade === "D").length }
    : null;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Gauge size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customerScoreTitle")}</h2>
        <p className="panel-sub">{t("customerScoreHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field">
            <label>{t("paymentTypeLabel")}</label>
            <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {paymentTypeOptions.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
            </select>
          </div>
        </div>

        <div className="quick-toggle-row">
          <button className={`quick-toggle-chip ${gradeFilter === "" ? "active" : ""}`} onClick={() => setGradeFilter("")}>{t("allStatus")}</button>
          {["A", "B", "C", "D"].map((g) => (
            <button key={g} className={`quick-toggle-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>
              {t("gradeLabel")} {g}{counts ? ` (${counts[g]})` : ""}
            </button>
          ))}
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {sortedRows && sortedRows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {sortedRows && sortedRows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("name")}>{t("customer")} {sortIcon("name")}</th>
                  <th className="sortable" onClick={() => toggleSort("collector")}>{t("collectorField")} {sortIcon("collector")}</th>
                  <th className="sortable" onClick={() => toggleSort("current_due")}>{t("balanceDue")} {sortIcon("current_due")}</th>
                  <th className="sortable" onClick={() => toggleSort("payment_type")}>{t("paymentTypeLabel")} {sortIcon("payment_type")}</th>
                  <th>{t("status")}</th>
                  <th className="sortable" onClick={() => toggleSort("score")}>{t("scoreLabel")} {sortIcon("score")}</th>
                  <th className="sortable" onClick={() => toggleSort("grade")}>{t("gradeLabel")} {sortIcon("grade")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                    <td data-label={t("balanceDue")}>
                      <RiyalAmount amount={r.current_due} />
                      {r.current_due > 0 && !r.has_open_invoice && (
                        <span className="status-tag warn" style={{ marginInlineStart: 6 }} title={t("legacyBalanceHint")}>
                          {t("legacyBalanceTag")}
                        </span>
                      )}
                    </td>
                    <td data-label={t("paymentTypeLabel")}>{r.payment_type || "—"}</td>
                    <td data-label={t("status")}>
                      <span className={`status-tag ${r.status}`}>{r.status}</span>
                    </td>
                    <td data-label={t("scoreLabel")} style={{ minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <bdi style={{ fontWeight: 700, fontSize: 12.5 }}>{r.score}</bdi>
                        <ScoreBar score={r.score} />
                      </div>
                    </td>
                    <td data-label={t("gradeLabel")}>
                      <span className={`fu-tag ${GRADE_TONE[r.grade]}`}>{r.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
