import { useEffect, useState, useCallback } from "react";
import { FileCheck2, Check, X as XIcon, Download, MessageCircle, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

function waLink(phone) {
  if (!phone) return null;
  // Saudi numbers are usually saved in local form (05XXXXXXXX) - wa.me
  // needs the bare international digits (966XXXXXXXXX), same normalization
  // used elsewhere in the app (waLink in ReconciliationsReport.jsx).
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) digits = "966" + digits.slice(3).replace(/^0+/, "");
  else if (digits.startsWith("0")) digits = "966" + digits.slice(1);
  return `https://wa.me/${digits}`;
}

function ReadinessBadge({ ok, okLabel, badLabel }) {
  return ok ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#1a7a4c", background: "#e6f4ec", padding: "4px 9px", borderRadius: 999 }}>
      <Check size={11} /> {okLabel}
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#b3541f", background: "#fbeee3", padding: "4px 9px", borderRadius: 999 }}>
      <XIcon size={11} /> {badLabel}
    </span>
  );
}

function PrepareSendPanel({ item, onClose, t, showToast }) {
  const [downloading, setDownloading] = useState(false);

  const handlePrepare = async () => {
    setDownloading(true);
    try {
      for (const att of item.attachments) {
        await api.downloadDraftInvoiceAttachment(att.id);
      }
      const message = `${t("draftInvoiceWhatsappGreeting")} ${item.partner_name}، ${t("draftInvoiceWhatsappBody")} ${item.invoice_origin || item.invoice_id} ${t("draftInvoiceWhatsappAmount")} `;
      const link = waLink(item.customer_phone);
      if (link) {
        window.open(`${link}?text=${encodeURIComponent(message)}`, "_blank");
      } else {
        showToast(t("draftInvoiceNoPhone"), "error");
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        <h3>{t("draftInvoicePrepareTitle")}</h3>
        <p className="prompt-message">{item.partner_name} · {item.invoice_origin || `#${item.invoice_id}`}</p>

        <div style={{ background: "var(--card)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8 }}>{t("draftInvoiceAttachmentsLabel")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {item.attachments.map((a) => (
              <div key={a.id} style={{ fontSize: 12.5 }}>📎 {a.name}</div>
            ))}
          </div>
        </div>

        {!item.customer_phone && (
          <div className="error-state" style={{ marginBottom: 10 }}>{t("draftInvoiceNoPhone")}</div>
        )}

        <button className="btn-primary" onClick={handlePrepare} disabled={downloading} style={{ width: "100%" }}>
          <MessageCircle size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
          {downloading ? t("draftInvoiceDownloading") : t("draftInvoicePrepareAction")}
        </button>
      </div>
    </div>
  );
}

export default function DraftInvoiceReadiness() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [panelItem, setPanelItem] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.draftInvoicesReadiness().then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const readyCount = rows ? rows.filter((r) => r.qty_ok && r.photo_ok).length : 0;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><FileCheck2 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("draftInvoiceReadinessTitle")}</h2>
            <p className="panel-sub">{t("draftInvoiceReadinessHint")}</p>
          </div>
          <button className="icon-btn" title={t("refresh")} onClick={load}><RefreshCw size={14} /></button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && rows.length === 0 && <div className="empty-state">{t("draftInvoiceNone")}</div>}

        {rows && rows.length > 0 && (
          <>
            <div className="quick-toggle-row" style={{ marginTop: 14, marginBottom: 14 }}>
              <span className="fu-tag sm ok">{t("draftInvoiceReadyCount")}: {readyCount}</span>
              <span className="fu-tag sm faint">{t("draftInvoiceTotalCount")}: {rows.length}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("customer")}</th>
                    <th>{t("balanceDue")}</th>
                    <th>{t("draftInvoiceQtyMatch")}</th>
                    <th>{t("draftInvoiceProof")}</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.invoice_id}>
                      <td data-label={t("customer")}>
                        <span className="cust-name">{r.partner_name}</span>
                        <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                          {r.invoice_origin || `#${r.invoice_id}`} · {r.invoice_date ? fmtDate(r.invoice_date) : "—"}
                        </div>
                      </td>
                      <td data-label={t("balanceDue")}><RiyalAmount amount={r.amount_total} /></td>
                      <td data-label={t("draftInvoiceQtyMatch")}>
                        <ReadinessBadge ok={r.qty_ok} okLabel={t("draftInvoiceMatched")} badLabel={t("draftInvoiceNotMatched")} />
                      </td>
                      <td data-label={t("draftInvoiceProof")}>
                        <ReadinessBadge ok={r.photo_ok} okLabel={t("draftInvoiceAvailable")} badLabel={t("draftInvoiceMissing")} />
                      </td>
                      <td data-label={t("actions")}>
                        {r.qty_ok && r.photo_ok ? (
                          <button className="btn-secondary sm" onClick={() => setPanelItem(r)}>
                            <Download size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("draftInvoicePrepareAction")}
                          </button>
                        ) : (
                          <span className="fu-tag sm faint">{t("draftInvoiceWaiting")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {panelItem && (
        <PrepareSendPanel item={panelItem} onClose={() => setPanelItem(null)} t={t} showToast={showToast} />
      )}
    </div>
  );
}
