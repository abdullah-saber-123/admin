import { useEffect, useState, useCallback } from "react";
import { HeartCrack, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";

export default function BrokenPromisesReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [collectors, setCollectors] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.brokenPromisesLog({ search, collector: collectorFilter, page, page_size: 30 })
      .then(setData).catch((e) => setError(e.message));
  }, [search, collectorFilter, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [search, collectorFilter]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><HeartCrack size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("brokenPromisesTitle")}</h2>
        <p className="panel-sub">{t("brokenPromisesHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field">
              <label>{t("collectorField")}</label>
              <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
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
                    <th>{t("customer")}</th>
                    <th>{t("collectorField")}</th>
                    <th>{t("promisedOn")}</th>
                    <th>{t("promiseDueDate")}</th>
                    <th>{t("detectedBrokenOn")}</th>
                    <th>{t("noteOptional")}</th>
                    <th>{t("timesBroken")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.id}>
                      <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                        <span className="cust-name">{r.customer_name}</span>
                      </td>
                      <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                      <td data-label={t("promisedOn")}>{r.promised_at ? fmtDateTime(r.promised_at) : "—"}</td>
                      <td data-label={t("promiseDueDate")}>{fmtDate(r.promise_due_date)}</td>
                      <td data-label={t("detectedBrokenOn")}>{fmtDateTime(r.detected_broken_at)}</td>
                      <td data-label={t("noteOptional")}>{r.promise_note || "—"}</td>
                      <td data-label={t("timesBroken")}>
                        <span className={`fu-tag ${r.total_times_broken > 1 ? "danger" : "faint"}`}>
                          {r.total_times_broken}×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
              <span className="page-info">{page} / {totalPages} · {data.total}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
