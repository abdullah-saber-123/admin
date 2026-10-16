import { useEffect, useState, useMemo } from "react";
import { Layers } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

const BUCKETS = [30, 45, 60, 90, 120];
const GRADE_TONE = { A: "ok", B: "teal", C: "warn", D: "danger" };
const STATUS_TONE = { best: "ok", restrict: "danger", stable: "faint", insufficient_data: "faint" };
const TREND_ICON = { up: "▲", down: "▼", flat: "●" };
const TREND_TONE = { up: "ok", down: "danger", flat: "faint" };

export default function CreditSegmentationReport() {
  const { t, money } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [bucketFilter, setBucketFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    api.creditSegmentation().then(setRows).catch((e) => setError(e.message));
  }, []);

  const summary = useMemo(() => {
    if (!rows) return null;
    const analyzed = rows.filter((r) => r.status !== "insufficient_data");
    const bucketCounts = Object.fromEntries(BUCKETS.map((b) => [b, analyzed.filter((r) => r.bucket_days === b).length]));
    const best = rows.filter((r) => r.status === "best");
    const restrict = rows.filter((r) => r.status === "restrict");
    const insufficient = rows.filter((r) => r.status === "insufficient_data");
    const netOpportunity = best.reduce((s, r) => s + (r.suggested_credit_limit - r.current_credit_limit), 0)
      + restrict.reduce((s, r) => s + (r.suggested_credit_limit - r.current_credit_limit), 0);
    return { bucketCounts, best, restrict, insufficient, netOpportunity, total: rows.length };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (bucketFilter && r.bucket_days !== bucketFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, bucketFilter, statusFilter]);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
          <Layers size={16} style={{ marginTop: 2 }} />
          <div>
            <h2 style={{ margin: 0 }}>{t("creditSegmentationTitle")}</h2>
            <p className="panel-sub" style={{ marginTop: 4 }}>{t("creditSegmentationHint")}</p>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}

        {summary && (
          <>
            <div className="kpi-mini-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "14px 0" }}>
              <button className="kpi-mini-card" onClick={() => { setStatusFilter(null); setBucketFilter(null); }} style={kpiCardStyle()}>
                <div style={kpiLabelStyle()}>{t("creditSegAnalyzed")}</div>
                <div style={kpiValueStyle()}>{summary.total}</div>
              </button>
              <button className="kpi-mini-card" onClick={() => setStatusFilter("best")} style={kpiCardStyle("ok")}>
                <div style={kpiLabelStyle()}>{t("creditSegOpportunity")}</div>
                <div style={kpiValueStyle("ok")}>{summary.best.length}</div>
              </button>
              <button className="kpi-mini-card" onClick={() => setStatusFilter("restrict")} style={kpiCardStyle("danger")}>
                <div style={kpiLabelStyle()}>{t("creditSegRestrict")}</div>
                <div style={kpiValueStyle("danger")}>{summary.restrict.length}</div>
              </button>
              <button className="kpi-mini-card" onClick={() => setStatusFilter("insufficient_data")} style={kpiCardStyle()}>
                <div style={kpiLabelStyle()}>{t("creditSegInsufficient")}</div>
                <div style={kpiValueStyle()}>{summary.insufficient.length}</div>
              </button>
              <div style={kpiCardStyle("accent")}>
                <div style={kpiLabelStyle()}>{t("creditSegNetOpportunity")}</div>
                <div style={kpiValueStyle("accent")}><RiyalAmount amount={summary.netOpportunity} /></div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button className={`filter-chip ${bucketFilter === null ? "active" : ""}`} onClick={() => setBucketFilter(null)}>{t("allLabel")}</button>
              {BUCKETS.map((b) => (
                <button key={b} className={`filter-chip ${bucketFilter === b ? "active" : ""}`} onClick={() => setBucketFilter(b)}>
                  {b} {t("daysShort")} ({summary.bucketCounts[b] || 0})
                </button>
              ))}
            </div>
          </>
        )}

        {filteredRows && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("creditSegAvgInterval")}</th>
                  <th>{t("creditSegRatio")}</th>
                  <th>{t("creditSegBucket")}</th>
                  <th>{t("creditSegTrend")}</th>
                  <th>{t("gradeLabel")}</th>
                  <th>{t("creditSegLimitChange")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")}><strong>{r.name}</strong></td>
                    {r.status === "insufficient_data" ? (
                      <td colSpan={5} data-label="">
                        <span className="fu-tag faint sm">{t("creditSegInsufficientRow")} ({r.payments_count})</span>
                      </td>
                    ) : (
                      <>
                        <td data-label={t("creditSegAvgInterval")}>{r.avg_interval_days} {t("daysShort")}</td>
                        <td data-label={t("creditSegRatio")}>{Math.round(r.payment_ratio * 100)}%</td>
                        <td data-label={t("creditSegBucket")}>
                          <span className={`fu-tag sm ${STATUS_TONE[r.status]}`}>{r.bucket_days} {t("daysShort")}</span>
                        </td>
                        <td data-label={t("creditSegTrend")}>
                          <span className={`fu-tag sm ${TREND_TONE[r.trend]}`}>{TREND_ICON[r.trend]} {t(`creditSegTrend_${r.trend}`)}</span>
                        </td>
                        <td data-label={t("gradeLabel")}><span className={`fu-tag sm ${GRADE_TONE[r.grade]}`}>{r.grade}</span></td>
                        <td data-label={t("creditSegLimitChange")}>
                          <RiyalAmount amount={r.current_credit_limit} /> {"→"} <strong><RiyalAmount amount={r.suggested_credit_limit} /></strong>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={7} className="empty-state">{t("noResults")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function kpiCardStyle(tone) {
  const colors = { ok: "var(--ok)", danger: "var(--danger)", accent: "var(--primary)" };
  return {
    background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px",
    textAlign: "start", cursor: "pointer", borderColor: tone ? colors[tone] + "55" : "var(--border)",
  };
}
function kpiLabelStyle() {
  return { fontSize: 11, color: "var(--text-dim)", marginBottom: 4 };
}
function kpiValueStyle(tone) {
  const colors = { ok: "var(--ok)", danger: "var(--danger)", accent: "var(--primary)" };
  return { fontSize: 19, fontWeight: 800, color: tone ? colors[tone] : "var(--text)" };
}
