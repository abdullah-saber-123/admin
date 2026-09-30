import { useEffect, useState, useCallback } from "react";
import { Link2Off, Copy, Check, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";
import { fmtDate } from "../dateUtils.js";

export default function UnmatchedCustomerPaymentsReport() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    const isSearching = !!search.trim();
    api.unmatchedCustomerPaymentsReport(isSearching ? { search: search.trim(), debug: true } : {})
      .then(setData).catch((e) => setError(e.message));
  }, [search]);

  useEffect(load, [load]);

  const copyName = (row) => {
    navigator.clipboard?.writeText(row.name).then(() => {
      setCopiedId(row.partner_id);
      setTimeout(() => setCopiedId((id) => (id === row.partner_id ? null : id)), 1500);
    });
  };

  const isSearching = !!search.trim();

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div>
          <h2><Link2Off size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("unmatchedPaymentsTitle")}</h2>
          <p className="panel-sub">{t("unmatchedPaymentsHint")}</p>
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
        </div>

        {isSearching && (
          <div style={{ background: "var(--card)", borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: "var(--text-dim)" }}>
            {t("unmatchedPaymentsSearchHint")}
          </div>
        )}

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

            {isSearching && data.debug_lines && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("unmatchedPaymentsRawLinesTitle")}</div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("unmatchedPaymentsColAccount")}</th>
                        <th>{t("unmatchedPaymentsColDate")}</th>
                        <th>{t("unmatchedPaymentsColDebit")}</th>
                        <th>{t("unmatchedPaymentsColCredit")}</th>
                        <th>{t("unmatchedPaymentsColResidual")}</th>
                        <th>{t("unmatchedPaymentsColMatching")}</th>
                        <th>{t("unmatchedPaymentsColReference")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.debug_lines.map((l, i) => (
                        <tr key={i}>
                          <td>{l.account_code || "—"}{data.accounts[l.account_code] ? ` (${data.accounts[l.account_code]})` : ""}</td>
                          <td>{l.line_date ? fmtDate(l.line_date) : "—"}</td>
                          <td><RiyalAmount amount={l.debit} /></td>
                          <td><RiyalAmount amount={l.credit} /></td>
                          <td style={{ fontWeight: l.residual ? 700 : 400, color: l.residual ? "var(--danger)" : "var(--ok)" }}>
                            <RiyalAmount amount={l.residual} />
                          </td>
                          <td>{l.matching_number || "—"}</td>
                          <td>{l.reference || "—"}</td>
                        </tr>
                      ))}
                      {data.debug_lines.length === 0 && (
                        <tr><td colSpan={7} className="empty-state">{t("noResults")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
