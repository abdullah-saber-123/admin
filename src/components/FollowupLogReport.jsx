import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Search, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime, fmtDate } from "../dateUtils.js";

export default function FollowupLogReport({ onSelectCustomer, initialDateFilter, onConsumeInitialFilter }) {
  const { t, statusLabel, lang, money } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [collectors, setCollectors] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [statusTones, setStatusTones] = useState({});
  const [statusOptions, setStatusOptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    api.followupCollectors().then(setCollectors).catch(() => {});
    api.followupStatuses().then((rows) => {
      setStatusTones(Object.fromEntries(rows.map((r) => [r.name, r.tone])));
      setStatusOptions(rows);
    }).catch(() => {});
  }, []);

  // A KPI card ("Follow-ups Today") can deep-link here with a specific date -
  // apply it once, then let the person clear/change the filter freely afterward.
  useEffect(() => {
    if (initialDateFilter) {
      setDateFrom(initialDateFilter);
      setDateTo(initialDateFilter);
      onConsumeInitialFilter?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDateFilter]);

  const load = useCallback(() => {
    setError(null);
    api.followupReport({
      search, username, status: statusFilter, date_from: dateFrom, date_to: dateTo,
      page, page_size: 30,
    }).then(setData).catch((e) => setError(e.message));
    api.followupSummary({
      search, username, status: statusFilter, date_from: dateFrom, date_to: dateTo,
    }).then(setSummary).catch(() => {});
  }, [search, username, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [search, username, statusFilter, dateFrom, dateTo]);

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2><ClipboardList size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("followupLogTitle")}</h2>
            <p className="panel-sub">{t("followupLogHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleDailyPdf} disabled={exportingPdf}>
            <Download size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingPdf ? t("exporting") : t("dailyPdfExport")}
          </button>
        </div>

        {summary && (
          <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
            <div className="insights-kpi-card accent-violet">
              <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("totalFollowupsLabel")}</div>
              </div>
              <div className="insights-kpi-value">{summary.total_followups.toLocaleString()}</div>
            </div>
            <div className="insights-kpi-card accent-teal">
              <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("totalCollectedFromFollowupsLabel")}</div>
              </div>
              <div className="insights-kpi-value">{money(summary.total_collected)}</div>
            </div>
            <div className="insights-kpi-card accent-danger">
              <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("totalOutstandingLabel")}</div>
              </div>
              <div className="insights-kpi-value">{money(summary.total_balance_due)}</div>
            </div>
            <div className="insights-kpi-card accent-amber">
              <span className="kpi-pulse kpi-pulse-lg" /><span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("totalPendingLabel")}</div>
              </div>
              <div className="insights-kpi-value">{summary.total_pending.toLocaleString()}</div>
            </div>
          </div>
        )}

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          {collectors.length > 0 && (
            <div className="more-filter-field">
              <label>{t("loggedBy")}</label>
              <select value={username} onChange={(e) => setUsername(e.target.value)}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div className="more-filter-field">
            <label>{t("status")}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {statusOptions.map((s) => (
                <option key={s.id} value={s.name}>{statusLabel(s.name)}</option>
              ))}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("fromDate")}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="more-filter-field">
            <label>{t("toDate")}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noFollowupsLogged")}</div>}

        {data && data.results.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("date")}</th>
                    <th>{t("customer")}</th>
                    <th>{t("invoiceNumber")}</th>
                    <th>{t("loggedBy")}</th>
                    <th>{t("status")}</th>
                    <th>{t("amountReceived")}</th>
                    <th>{t("paymentMode")}</th>
                    <th>{t("noteOptional")}</th>
                    <th>{t("nextFollowupDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((f) => (
                    <tr key={f.id} onClick={() => onSelectCustomer?.(f.partner_id)}>
                      <td data-label={t("date")}>{fmtDateTime(f.created_at)}</td>
                      <td data-label={t("customer")}><span className="cust-name">{f.customer_name}</span></td>
                      <td data-label={t("invoiceNumber")}>{f.invoice_number ? <bdi dir="ltr">{f.invoice_number}</bdi> : "—"}</td>
                      <td data-label={t("loggedBy")}>{f.username}</td>
                      <td data-label={t("status")}>
                        <span className={`fu-tag sm ${statusTones[f.status] || "faint"}`}>{statusLabel(f.status)}</span>
                      </td>
                      <td data-label={t("amountReceived")}>
                        {f.amount != null ? <span className="fu-entry-payment">{f.amount.toLocaleString()}</span> : "—"}
                      </td>
                      <td data-label={t("paymentMode")}>{f.payment_mode || "—"}</td>
                      <td data-label={t("noteOptional")}>{f.note || "—"}</td>
                      <td data-label={t("nextFollowupDate")}>{f.next_follow_up_date ? fmtDate(f.next_follow_up_date) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
              <span className="page-info"><bdi>{page} / {totalPages} · {data.total}</bdi></span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
