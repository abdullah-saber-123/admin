import { useEffect, useState } from "react";
import { UserSearch, Download, ClipboardList } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CollectorActivityExplorer() {
  const { t, statusLabel, money, lang } = useLang();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState([]);
  const [collectorId, setCollectorId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    api.collectorReport().then((rows) => {
      setStaffList(rows);
      if (rows.length > 0) setCollectorId(String(rows[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!collectorId) return;
    setLoading(true);
    setError(null);
    api.collectorActivityForDate(collectorId, selectedDate)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [collectorId, selectedDate]);

  const handleDownloadPdf = async () => {
    if (!collectorId) return;
    setDownloadingPdf(true);
    try {
      await api.collectorActivityPdf(collectorId, selectedDate, lang);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const k = data?.kpis;
  const queuePct = k && k.queue_count ? Math.round((k.completed_count / k.queue_count) * 100) : null;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><UserSearch size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("collectorActivityExplorerTitle")}</h2>
        <p className="panel-sub">{t("collectorActivityExplorerHint")}</p>

        <div className="collector-activity-picker">
          <div>
            <label className="collector-activity-picker-label">{t("collectorField")}</label>
            <select value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="collector-activity-picker-label">{t("dateLabel")}</label>
            <input type="date" value={selectedDate} max={todayIso()} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <button className="btn-secondary sm" onClick={handleDownloadPdf} disabled={downloadingPdf || !data}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {downloadingPdf ? t("exporting") : t("downloadPdfReport")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {loading && <div className="loading-state">{t("loadingDots")}</div>}

        {data && !loading && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 18, marginTop: 18 }}>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("totalFollowupsLabel")}</div></div>
                <div className="insights-kpi-value">{k.total_followups}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("customersContactedLabel")}</div></div>
                <div className="insights-kpi-value">{k.distinct_customers_contacted}</div>
              </div>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("totalCollectedFromFollowupsLabel")}</div></div>
                <div className="insights-kpi-value">{money(k.collected)}</div>
              </div>
              {queuePct !== null && (
                <div className="insights-kpi-card accent-danger">
                  <div className="insights-kpi-top"><div className="insights-kpi-label">{t("todayProgressLabel")}</div></div>
                  <div className="insights-kpi-value">{k.completed_count}/{k.queue_count} ({queuePct}%)</div>
                </div>
              )}
            </div>

            {data.status_breakdown.length > 0 && (
              <div className="my-day-outcomes-card">
                <div className="my-day-outcomes-title">{t("todayOutcomesTitle")}</div>
                <div className="my-day-outcomes-chips">
                  {data.status_breakdown.map((o) => (
                    <span key={o.status} className="my-day-outcome-chip">
                      {statusLabel(o.status)}: <strong>{o.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <h3 className="insights-chart-title" style={{ margin: "18px 0 8px" }}>
              <ClipboardList size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("activityLogTitle")}
            </h3>
            {data.activity.length === 0 ? (
              <div className="empty-state">{t("noActivityOnDate")}</div>
            ) : (
              <div className="fu-history">
                {data.activity.map((a) => (
                  <div key={a.id} className="fu-entry">
                    <div className="fu-entry-top">
                      <span className="fu-tag sm">{statusLabel(a.status)}</span>
                      <span className="fu-entry-meta">{a.customer_name} · {fmtDateTime(a.created_at)}</span>
                    </div>
                    {a.note && <div className="fu-entry-note">{a.note}</div>}
                    {a.amount != null && (
                      <div className="fu-entry-note fu-entry-payment"><RiyalAmount amount={a.amount} />{a.payment_mode ? ` · ${a.payment_mode}` : ""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
