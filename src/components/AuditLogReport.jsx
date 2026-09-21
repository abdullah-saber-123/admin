import { useEffect, useState } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";

const ACTIONS = ["discount_approved", "debt_writeoff_approved", "credit_limit_changed", "reconciliation_confirmed"];

export default function AuditLogReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    const timer = setTimeout(() => {
      api.auditLog({ dateFrom, dateTo, action, search, page, pageSize: 50 }).then(setData).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, action, search, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><ShieldCheck size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("auditLogTitle")}</h2>
        <p className="panel-sub">{t("auditLogHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field">
            <label>{t("auditLogActionType")}</label>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">{t("allStatus")}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{t(`auditAction_${a}`)}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("discountDateFrom")}</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="more-filter-field">
            <label>{t("discountDateTo")}</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {data && data.results.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("date")}</th>
                    <th>{t("auditLogActionType")}</th>
                    <th>{t("customer")}</th>
                    <th>{t("auditLogActor")}</th>
                    <th>{t("auditLogDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.id}>
                      <td data-label={t("date")} style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</td>
                      <td data-label={t("auditLogActionType")}><span className="fu-tag teal">{t(`auditAction_${r.action}`)}</span></td>
                      <td data-label={t("customer")}>
                        {r.partner_id ? (
                          <span className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>{r.partner_name || r.partner_id}</span>
                        ) : "—"}
                      </td>
                      <td data-label={t("auditLogActor")}>{r.actor_username}</td>
                      <td data-label={t("auditLogDetails")} style={{ maxWidth: 420 }}>{r.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <button className="btn-secondary sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                <span className="settings-meta">{page} / {totalPages}</span>
                <button className="btn-secondary sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
