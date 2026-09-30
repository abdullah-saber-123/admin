import { useEffect, useState } from "react";
import { Scale, Search, Download } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function LegalHoldReport({ onSelectCustomer }) {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    api.legalHoldCustomers().then(setRows).catch((e) => setError(e.message));
  }, []);

  const filtered = (rows || []).filter((r) => !search.trim() || r.name?.toLowerCase().includes(search.trim().toLowerCase()));
  const totalDue = filtered.reduce((sum, r) => sum + (r.current_due || 0), 0);
  const totalOverdue = filtered.reduce((sum, r) => sum + (r.overdue_amount || 0), 0);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await api.exportLegalHoldCustomersPdf(lang);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Scale size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("legalHoldTitle")}</h2>
            <p className="panel-sub">{t("legalHoldHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exportingPdf || !rows || rows.length === 0}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exportingPdf ? t("exporting") : t("print")}
          </button>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && filtered.length === 0 && <div className="empty-state">{t("legalHoldNoCustomers")}</div>}

        {rows && filtered.length > 0 && (
          <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
            <span>{filtered.length} {t("customersSuffix")}</span>
            <span className="table-totals-item">{t("totalDue")}: <strong><RiyalAmount amount={totalDue} /></strong></span>
            <span className="table-totals-item">{t("overdueAmount")}: <strong><RiyalAmount amount={totalOverdue} /></strong></span>
          </div>
        )}

        {rows && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("collectorField")}</th>
                  <th>{t("totalDue")}</th>
                  <th>{t("overdueAmount")}</th>
                  <th>{t("legalHoldReasonLabel")}</th>
                  <th>{t("legalHoldByLabel")}</th>
                  <th>{t("legalHoldSinceLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("collectorField")}>{r.salesperson_name || "—"}</td>
                    <td data-label={t("totalDue")}><RiyalAmount amount={r.current_due} /></td>
                    <td data-label={t("overdueAmount")}><RiyalAmount amount={r.overdue_amount} /></td>
                    <td data-label={t("legalHoldReasonLabel")}>{r.legal_hold_reason || "—"}</td>
                    <td data-label={t("legalHoldByLabel")}>{r.legal_hold_by || "—"}</td>
                    <td data-label={t("legalHoldSinceLabel")}>{r.legal_hold_at ? fmtDateTime(r.legal_hold_at) : "—"}</td>
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
