import { useEffect, useState } from "react";
import { Phone, MessageCircle, Receipt } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export default function DueTodayReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.dueTodayReport().then(setRows).catch((e) => setError(e.message));
  }, []);

  const total = rows ? rows.reduce((s, r) => s + (r.amount_residual || 0), 0) : 0;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Receipt size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("dueTodayReportTitle")}</h2>
        <p className="panel-sub">{t("dueTodayReportHint")}</p>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && rows.length === 0 && <div className="empty-state">{t("noInvoicesDueToday")}</div>}

        {rows && rows.length > 0 && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{t("totalsFor")} <bdi>{rows.length}</bdi> {t("invoicesSuffix")}:</span>
              <span className="table-totals-item"><strong><RiyalAmount amount={total} /></strong></span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("customer")}</th>
                    <th>{t("phone")}</th>
                    <th>{t("invoiceNumber")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("collector")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.invoice_id} onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <td data-label={t("customer")}>
                        <span className="cust-name">{r.customer_name}</span>
                      </td>
                      <td data-label={t("phone")}>
                        <span className="cell-icon">
                          <bdi dir="ltr">{r.phone || "—"}</bdi>
                          {r.phone && (
                            <>
                              <a href={`tel:${r.phone}`} className="quick-action" onClick={(e) => e.stopPropagation()}>
                                <Phone size={12} />
                              </a>
                              <a href={waLink(r.phone)} target="_blank" rel="noreferrer" className="quick-action wa" onClick={(e) => e.stopPropagation()}>
                                <MessageCircle size={12} />
                              </a>
                            </>
                          )}
                        </span>
                      </td>
                      <td data-label={t("invoiceNumber")}>{r.number}</td>
                      <td data-label={t("amount")}>
                        <span className="due-amount has-balance"><RiyalAmount amount={r.amount_residual} /></span>
                      </td>
                      <td data-label={t("collector")}>{r.collector || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
