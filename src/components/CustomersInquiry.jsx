import { useEffect, useState, useCallback } from "react";
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Target, X } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";

const SORT_COLS = ["name", "collector", "last_invoice_date", "city", "region", "payment_type"];

export default function CustomersInquiry({ onSelectCustomer }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [collector, setCollector] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retargetModalFor, setRetargetModalFor] = useState(null);
  const [retargetReason, setRetargetReason] = useState("");
  const [submittingRetarget, setSubmittingRetarget] = useState(false);
  const pageSize = 30;

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.fieldOptions("region").then((opts) => setRegions(opts.map((o) => o.value))).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
    api.fieldOptions("payment_type").then((opts) => setPaymentTypes(opts.map((o) => o.value))).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.customersInquiryReport({
      search, city, region, collector, payment_type: paymentType,
      sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize,
    }).then(setData).catch((e) => setError(e.message));
  }, [search, city, region, collector, paymentType, sortBy, sortDir, page]);

  useEffect(load, [load]);

  useEffect(() => { setPage(1); }, [search, city, region, collector, paymentType, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key) => {
    if (sortBy !== key) {
      return <ArrowUpDown size={12} style={{ verticalAlign: -1, marginInlineStart: 3, opacity: 0.35 }} />;
    }
    const Icon = sortDir === "asc" ? ArrowUp : ArrowDown;
    return <Icon size={12} style={{ verticalAlign: -1, marginInlineStart: 3 }} />;
  };

  const handleRetarget = async (e) => {
    e.preventDefault();
    if (!retargetReason.trim()) return;
    setSubmittingRetarget(true);
    try {
      await api.createRetargetCase(retargetModalFor.partner_id, retargetReason.trim());
      showToast(t("retargetCaseCreated"), "success");
      setRetargetModalFor(null);
      setRetargetReason("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmittingRetarget(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div>
          <h2><Search size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customersInquiryTitle")}</h2>
          <p className="panel-sub">{t("customersInquiryHint")}</p>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("regionLabel")}</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field">
              <label>{t("collectorField")}</label>
              <select value={collector} onChange={(e) => setCollector(e.target.value)}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="more-filter-field">
            <label>{t("paymentTypeLabel")}</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {paymentTypes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{data.total} {t("customersSuffix")}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {SORT_COLS.map((col) => (
                      <th key={col} onClick={() => toggleSort(col)} style={{ cursor: "pointer" }}>
                        {t(`customersInquiryCol_${col}`)}{sortIcon(col)}
                      </th>
                    ))}
                    <th>{t("customersInquiryColAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((c) => (
                    <tr key={c.partner_id}>
                      <td>
                        <button className="link-btn" onClick={() => onSelectCustomer(c.partner_id)}>{c.name}</button>
                      </td>
                      <td>{c.collector || "—"}</td>
                      <td>{c.last_invoice_date ? fmtDate(c.last_invoice_date) : "—"}</td>
                      <td>{c.city || "—"}</td>
                      <td>{c.region || "—"}</td>
                      <td>{c.payment_type || "—"}</td>
                      <td>
                        <button
                          className="btn-secondary sm"
                          onClick={() => { setRetargetModalFor(c); setRetargetReason(""); }}
                          title={t("retargetButton")}
                        >
                          <Target size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                          {t("retargetButton")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.results.length === 0 && (
                    <tr><td colSpan={SORT_COLS.length + 1} className="empty-state">{t("noResults")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
                <span className="page-info"><bdi>{page} / {totalPages} · {data.total}</bdi> {t("customersSuffix")}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
              </div>
            )}
          </>
        )}
      </div>

      {retargetModalFor && (
        <div className="overlay modal-overlay" onClick={() => setRetargetModalFor(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setRetargetModalFor(null)}><X size={16} /></button>
            <h3><Target size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("retargetButton")}</h3>
            <p className="prompt-message">{retargetModalFor.name}</p>
            <form onSubmit={handleRetarget}>
              <label>{t("retargetReasonLabel")}</label>
              <textarea rows={3} value={retargetReason} onChange={(e) => setRetargetReason(e.target.value)} placeholder={t("retargetReasonPlaceholder")} autoFocus />
              <div className="prompt-actions">
                <button type="button" className="btn-secondary" onClick={() => setRetargetModalFor(null)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary" disabled={!retargetReason.trim() || submittingRetarget}>
                  {submittingRetarget ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
