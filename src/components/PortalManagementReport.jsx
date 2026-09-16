import { useEffect, useState, useCallback } from "react";
import { Smartphone, Search, KeyRound, Users as UsersIcon, Copy } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function PortalManagementReport({ onSelectCustomer }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(""); // "" | "yes" | "no"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [creds, setCreds] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.portalAccounts({
      search, has_portal: filter === "" ? "" : filter === "yes",
    }).then(setRows).catch((e) => setError(e.message));
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const createOrReset = async (partnerId) => {
    setBusyId(partnerId);
    try {
      const res = await api.createPortalAccess(partnerId);
      setCreds(res);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row) => {
    setBusyId(row.partner_id);
    try {
      await api.togglePortalAccess(row.partner_id, !row.portal_active);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const runBulkCreate = async () => {
    setBulkRunning(true);
    try {
      const res = await api.bulkCreatePortalAccess();
      setBulkResult(res);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBulkRunning(false);
    }
  };

  const copyBulkList = () => {
    const text = bulkResult.accounts
      .map((a) => `${a.name} | ${a.phone || "-"} | ${t("portalUsernameLabel")}: ${a.username} | ${t("portalPasswordLabel")}: ${a.password}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    showToast(t("copied"), "success");
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2><Smartphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("portalManagementTitle")}</h2>
            <p className="panel-sub">{t("portalManagementHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={runBulkCreate} disabled={bulkRunning}>
            <UsersIcon size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {bulkRunning ? t("saving") : t("bulkCreatePortal")}
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
        <div className="quick-toggle-row">
          <button className={`quick-toggle-chip ${filter === "" ? "active" : ""}`} onClick={() => setFilter("")}>{t("allStatus")}</button>
          <button className={`quick-toggle-chip ${filter === "yes" ? "active" : ""}`} onClick={() => setFilter("yes")}>{t("portalHasAccess")}</button>
          <button className={`quick-toggle-chip ${filter === "no" ? "active" : ""}`} onClick={() => setFilter("no")}>{t("portalNoAccess")}</button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && rows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("balanceDue")}</th>
                  <th>{t("portalStatus")}</th>
                  <th>{t("portalLastLogin")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_due} /></td>
                    <td data-label={t("portalStatus")}>
                      {r.portal_username ? (
                        <span className={`fu-tag ${r.portal_active ? "ok" : "faint"}`}>
                          {r.portal_active ? t("portalActive") : t("portalDisabled")}
                        </span>
                      ) : (
                        <span className="fu-tag faint">{t("portalNotSet")}</span>
                      )}
                    </td>
                    <td data-label={t("portalLastLogin")}>
                      {r.portal_last_login ? fmtDateTime(r.portal_last_login) : "—"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-secondary sm" disabled={busyId === r.partner_id} onClick={() => createOrReset(r.partner_id)}>
                          <KeyRound size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                          {r.portal_username ? t("resetPortalAccess") : t("createPortalAccess")}
                        </button>
                        {r.portal_username && (
                          <button className="icon-btn" title={r.portal_active ? t("disable") : t("enable")} disabled={busyId === r.partner_id} onClick={() => toggleActive(r)}>
                            {r.portal_active ? "⏸" : "▶"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creds && (
        <div className="overlay modal-overlay" onClick={() => setCreds(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("portalCredentialsTitle")}</h3>
            <p className="prompt-message">{t("portalCredentialsHint")}</p>
            <div className="portal-creds-box">
              <div><span>{t("portalUsernameLabel")}:</span> <bdi dir="ltr">{creds.username}</bdi></div>
              <div><span>{t("portalPasswordLabel")}:</span> <bdi dir="ltr">{creds.password}</bdi></div>
            </div>
            <div className="prompt-actions">
              <button className="btn-primary" onClick={() => setCreds(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {bulkResult && (
        <div className="overlay modal-overlay" onClick={() => setBulkResult(null)}>
          <div className="prompt-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h3>{t("bulkCreateResultTitle")} ({bulkResult.created_count})</h3>
            {bulkResult.created_count === 0 ? (
              <p className="prompt-message">{t("bulkCreateNoneNeeded")}</p>
            ) : (
              <>
                <p className="prompt-message">{t("portalCredentialsHint")}</p>
                <div className="portal-proof-list" style={{ maxHeight: 320, overflowY: "auto" }}>
                  {bulkResult.accounts.map((a) => (
                    <div key={a.partner_id} className="portal-proof-item">
                      <div>
                        <div className="portal-proof-amount">{a.name}</div>
                        <div className="portal-proof-date">
                          <bdi dir="ltr">{a.username} / {a.password}</bdi>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary sm" style={{ marginTop: 10 }} onClick={copyBulkList}>
                  <Copy size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {t("copyAll")}
                </button>
              </>
            )}
            <div className="prompt-actions">
              <button className="btn-primary" onClick={() => setBulkResult(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
