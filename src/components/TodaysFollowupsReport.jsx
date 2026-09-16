import { useEffect, useState } from "react";
import { CalendarCheck2, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";

export default function TodaysFollowupsReport({ onSelectCustomer }) {
  const { t, statusLabel, lang } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [statusTones, setStatusTones] = useState({});
  const [exportingPdf, setExportingPdf] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = () => {
    setError(null);
    api.followupReport({ date_from: todayStr, date_to: todayStr, page: 1, page_size: 200 })
      .then(setData)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    api.followupStatuses().then((rows) => {
      setStatusTones(Object.fromEntries(rows.map((r) => [r.name, r.tone])));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDailyPdf = async () => {
    setExportingPdf(true);
    try {
      await api.followupDailyPdf(lang);
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2><CalendarCheck2 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("todaysFollowupsTitle")}</h2>
            <p className="panel-sub">{t("todaysFollowupsHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleDailyPdf} disabled={exportingPdf}>
            <Download size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingPdf ? t("exporting") : t("dailyPdfExport")}
          </button>
        </div>

        {data && (
          <div className="table-totals-row" style={{ marginTop: 14, marginBottom: 14 }}>
            <span className="table-totals-item">{t("followupsToday")}: <strong>{data.total}</strong></span>
          </div>
        )}

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {data && data.results.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("time")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("status")}</th>
                  <th>{t("noteOptional")}</th>
                  <th>{t("loggedBy")}</th>
                  <th>{t("nextFollowUpDate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((f) => (
                  <tr key={f.id}>
                    <td data-label={t("time")}>{fmtDateTime(f.created_at)}</td>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(f.partner_id)}>
                      <span className="cust-name">{f.customer_name}</span>
                    </td>
                    <td data-label={t("status")}>
                      <span className={`fu-tag sm ${statusTones[f.status] || "faint"}`}>{statusLabel(f.status)}</span>
                    </td>
                    <td data-label={t("noteOptional")}>{f.note || "—"}</td>
                    <td data-label={t("loggedBy")}>{f.username}</td>
                    <td data-label={t("nextFollowUpDate")}>{f.next_follow_up_date || "—"}</td>
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
