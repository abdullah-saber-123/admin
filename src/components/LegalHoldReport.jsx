import { useEffect, useState } from "react";
import { Scale, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function LegalHoldReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.legalHoldCustomers().then(setRows).catch((e) => setError(e.message));
  }, []);

  const filtered = (rows || []).filter((r) => !search.trim() || r.name?.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Scale size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("legalHoldTitle")}</h2>
        <p className="panel-sub">{t("legalHoldHint")}</p>

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
