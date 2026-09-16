import { useEffect, useState, useCallback } from "react";
import { Gauge, Search } from "lucide-react";
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
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.customerScores({ search, grade: gradeFilter }).then(setRows).catch((e) => setError(e.message));
  }, [search, gradeFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

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
        {rows && rows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("collectorField")}</th>
                  <th>{t("balanceDue")}</th>
                  <th>{t("status")}</th>
                  <th>{t("scoreLabel")}</th>
                  <th>{t("gradeLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_due} /></td>
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
