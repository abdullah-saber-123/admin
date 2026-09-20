import { useEffect, useState } from "react";
import { BarChart3, Download, TrendingUp, Wallet, PiggyBank, Users, Crown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function PerformanceReport() {
  const { t, money } = useLang();
  const { showToast } = useToast();
  const [period, setPeriod] = useState("monthly");
  const [asOf, setAsOf] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setData(null);
    api.performanceReport(period, asOf || null).then(setData).catch((e) => setError(e.message));
  }, [period, asOf]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportPerformanceReport(period, asOf || null);
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><BarChart3 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("performanceReportTitle")}</h2>
            <p className="panel-sub">{t("performanceReportHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExport} disabled={exporting || !data}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exporting ? t("exporting") : t("export")}
          </button>
        </div>

        <div className="quick-toggle-row" style={{ alignItems: "center" }}>
          {["daily", "monthly", "yearly"].map((p) => (
            <button key={p} className={`quick-toggle-chip ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
              {t(`period_${p}`)}
            </button>
          ))}
          <input
            type="date" className="my-day-search-input" style={{ maxWidth: 160 }}
            value={asOf} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setAsOf(e.target.value)}
            title={t("reportAsOfLabel")}
          />
          {asOf && (
            <button className="btn-secondary sm" onClick={() => setAsOf("")}>{t("resetToToday")}</button>
          )}
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 14px" }}>
              {fmtDate(data.start_date)} — {fmtDate(data.end_date)}
            </p>

            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-violet">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("totalSalesLabel")}</div>
                  <div className="insights-kpi-icon"><TrendingUp size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(data.total_sales)}</div>
              </div>
              <div className="insights-kpi-card accent-teal">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("collected")}</div>
                  <div className="insights-kpi-icon"><Wallet size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(data.total_collected)}</div>
                {data.collection_rate !== null && (
                  <div className="my-day-city">{t("collectionRate")}: {data.collection_rate}%</div>
                )}
              </div>
              <div className="insights-kpi-card accent-danger">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("totalOutstandingLabel")}</div>
                  <div className="insights-kpi-icon"><PiggyBank size={15} /></div>
                </div>
                <div className="insights-kpi-value">{money(data.total_outstanding)}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
                <div className="insights-kpi-top">
                  <div className="insights-kpi-label">{t("followUpRatioLabel")}</div>
                  <div className="insights-kpi-icon"><Users size={15} /></div>
                </div>
                <div className="insights-kpi-value">{data.follow_up.contacted_pct}%</div>
                <div className="my-day-city">{data.follow_up.contacted} / {data.follow_up.total_customers} {t("customersSuffix")}</div>
              </div>
            </div>

            <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>
              <Crown size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("collectorLeaderboardTitle")}
            </h3>
            {data.leaderboard.length === 0 ? (
              <div className="empty-state">{t("noActivity")}</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("collectorField")}</th>
                      <th>{t("collected")}</th>
                      <th>{t("target")}</th>
                      <th>{t("balanceDue")}</th>
                      <th>{t("totalCustomersLabel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((r) => (
                      <tr key={r.collector}>
                        <td data-label="#">
                          {r.rank === 1 ? <Crown size={14} style={{ color: "#F4A460" }} /> : r.rank}
                        </td>
                        <td data-label={t("collectorField")}><span className="cust-name">{r.collector}</span></td>
                        <td data-label={t("collected")}><strong><RiyalAmount amount={r.collected} /></strong></td>
                        <td data-label={t("target")}>
                          {r.target ? (
                            <span className={r.target_pct >= 100 ? "trend-pill up" : ""}>{r.target_pct}%</span>
                          ) : "—"}
                        </td>
                        <td data-label={t("balanceDue")}><RiyalAmount amount={r.outstanding} /></td>
                        <td data-label={t("totalCustomersLabel")}>{r.customer_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
