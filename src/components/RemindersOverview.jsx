import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function RemindersOverview({ onSelectCustomer }) {
  const { t, statusLabel } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [collectorFilter, setCollectorFilter] = useState("");

  useEffect(() => {
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  useEffect(() => {
    setError(null);
    api.remindersOverview(collectorFilter).then(setRows).catch((e) => setError(e.message));
  }, [collectorFilter]);

  const overdueCount = rows ? rows.filter((r) => r.is_overdue).length : 0;
  const todayCount = rows ? rows.filter((r) => !r.is_overdue).length : 0;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><BellRing size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("remindersOverviewTitle")}</h2>
        <p className="panel-sub">{t("remindersOverviewHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("collectorField")}</label>
            <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {collectors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {rows && rows.length > 0 && (
          <div className="table-totals-row" style={{ marginBottom: 14 }}>
            <span className="table-totals-item">{t("dueToday")}: <strong>{todayCount}</strong></span>
            <span className="table-totals-item">{t("overdueReminders")}: <strong style={{ color: "var(--danger)" }}>{overdueCount}</strong></span>
          </div>
        )}

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
                  <th>{t("followUp")}</th>
                  <th>{t("nextFollowUpDate")}</th>
                  <th>{t("balanceDue")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                    <td data-label={t("followUp")}>{r.follow_up_status ? statusLabel(r.follow_up_status) : "—"}</td>
                    <td data-label={t("nextFollowUpDate")}>
                      <span className={r.is_overdue ? "overdue-text" : ""}>{fmtDate(r.next_follow_up_date)}</span>
                      {r.is_overdue && <span className="fu-tag sm danger" style={{ marginInlineStart: 6 }}>{t("overdueReminders")}</span>}
                    </td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_due} /></td>
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
