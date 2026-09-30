import { useEffect, useState } from "react";
import { Link2Off, Copy, Check } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function UnmatchedCustomerPaymentsReport() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    api.unmatchedCustomerPaymentsReport().then(setData).catch((e) => setError(e.message));
  }, []);

  const copyName = (row) => {
    navigator.clipboard?.writeText(row.name).then(() => {
      setCopiedId(row.partner_id);
      setTimeout(() => setCopiedId((id) => (id === row.partner_id ? null : id)), 1500);
    });
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div>
          <h2><Link2Off size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("unmatchedPaymentsTitle")}</h2>
          <p className="panel-sub">{t("unmatchedPaymentsHint")}</p>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="table-totals-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <span>{data.results.length} {t("customersSuffix")}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("customer")}</th>
                    <th>{t("collectorField")}</th>
                    <th>{t("cityLabel")}</th>
                    <th>{t("unmatchedPaymentsDebitCol")}</th>
                    <th>{t("unmatchedPaymentsCreditCol")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.partner_id}>
                      <td>{r.name}</td>
                      <td>{r.collector || "—"}</td>
                      <td>{r.city || "—"}</td>
                      <td><RiyalAmount amount={r.unmatched_debit} /></td>
                      <td><RiyalAmount amount={r.unmatched_credit} /></td>
                      <td>
                        <button className="btn-secondary sm" onClick={() => copyName(r)} title={t("unmatchedPaymentsCopyName")}>
                          {copiedId === r.partner_id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.results.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">{t("noResults")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
