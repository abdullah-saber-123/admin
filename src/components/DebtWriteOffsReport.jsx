import { useEffect, useState, useCallback } from "react";
import { FileX, Search, Check, X as XIcon, Undo2, Plus } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { pending: "warn", approved: "danger", rejected: "faint", reversed: "faint" };

function RequestModal({ onClose, onRequested, t, showToast }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api.customers({ search: search.trim(), page_size: 8 }).then((data) => setResults(data.results)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const pickCustomer = (c) => {
    setSelected(c);
    setAmount(c.current_due || "");
    setSearch("");
    setResults(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || !reason.trim()) return;
    setSaving(true);
    try {
      await api.requestDebtWriteOff(selected.partner_id, reason.trim(), Number(amount) || null);
      showToast(t("saved"), "success");
      onRequested();
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        <h3>{t("requestWriteOff")}</h3>
        <form onSubmit={handleSubmit}>
          {!selected ? (
            <>
              <label>{t("customer")}</label>
              <div className="search-bar" style={{ position: "relative" }}>
                <Search size={14} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchCustomerForReport")} autoFocus />
                {results && results.length > 0 && (
                  <div className="monthly-report-search-results">
                    {results.map((c) => (
                      <button key={c.partner_id} type="button" className="global-search-result" onClick={() => pickCustomer(c)}>
                        <span className="gsr-title">{c.name}</span>
                        <span className="gsr-sub"><RiyalAmount amount={c.current_due} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="prompt-message">
                <strong>{selected.name}</strong> — {t("balanceDue")}: <RiyalAmount amount={selected.current_due} />
              </p>
              <label>{t("writeOffAmountLabel")}</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <label style={{ marginTop: 10, display: "block" }}>{t("writeOffReasonLabel")}</label>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("writeOffReasonPlaceholder")} />
            </>
          )}
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!selected || !reason.trim() || saving}>
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DebtWriteOffsReport({ onSelectCustomer, role }) {
  const { t, money } = useLang();
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.debtWriteOffs(statusFilter).then(setRows).catch((e) => setError(e.message));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDecide = async (row, approve) => {
    setBusyId(row.id);
    try {
      await api.decideDebtWriteOff(row.id, approve);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReverse = async (row) => {
    setBusyId(row.id);
    try {
      await api.reverseDebtWriteOff(row.id);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = (rows || []).filter((r) => r.status === "pending").length;
  const approvedTotal = (rows || []).filter((r) => r.status === "approved").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><FileX size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("debtWriteOffsTitle")}</h2>
            <p className="panel-sub">{t("debtWriteOffsHint")}</p>
          </div>
          <button className="btn-secondary sm" onClick={() => setShowRequest(true)}>
            <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("requestWriteOff")}
          </button>
        </div>

        <div className="insights-kpi-grid" style={{ marginBottom: 18, marginTop: 14 }}>
          <div className="insights-kpi-card accent-amber">
            <div className="insights-kpi-top"><div className="insights-kpi-label">{t("pendingWriteOffs")}</div></div>
            <div className="insights-kpi-value">{pendingCount}</div>
          </div>
          <div className="insights-kpi-card accent-danger">
            <div className="insights-kpi-top"><div className="insights-kpi-label">{t("approvedWriteOffsTotal")}</div></div>
            <div className="insights-kpi-value">{money(approvedTotal)}</div>
          </div>
        </div>

        <div className="quick-toggle-row" style={{ marginBottom: 14 }}>
          <button className={`quick-toggle-chip ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>{t("allStatus")}</button>
          {["pending", "approved", "rejected", "reversed"].map((s) => (
            <button key={s} className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {t(`writeOffStatus_${s}`)}
            </button>
          ))}
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
                  <th>{t("writeOffAmountLabel")}</th>
                  <th>{t("balanceDue")}</th>
                  <th>{t("writeOffReasonLabel")}</th>
                  <th>{t("status")}</th>
                  <th>{t("requestedByLabel")}</th>
                  {role === "admin" && <th>{t("actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.customer_name}</span>
                    </td>
                    <td data-label={t("writeOffAmountLabel")}><RiyalAmount amount={r.amount} /></td>
                    <td data-label={t("balanceDue")}>{r.current_balance !== null ? <RiyalAmount amount={r.current_balance} /> : "—"}</td>
                    <td data-label={t("writeOffReasonLabel")}>{r.reason}</td>
                    <td data-label={t("status")}>
                      <span className={`fu-tag sm ${STATUS_TONE[r.status]}`}>{t(`writeOffStatus_${r.status}`)}</span>
                    </td>
                    <td data-label={t("requestedByLabel")}>
                      {r.requested_by}
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{fmtDateTime(r.requested_at)}</div>
                    </td>
                    {role === "admin" && (
                      <td data-label={t("actions")}>
                        {r.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="icon-btn" title={t("accept")} disabled={busyId === r.id} onClick={() => handleDecide(r, true)}>
                              <Check size={13} />
                            </button>
                            <button className="icon-btn" title={t("reject")} disabled={busyId === r.id} onClick={() => handleDecide(r, false)}>
                              <XIcon size={13} />
                            </button>
                          </div>
                        )}
                        {r.status === "approved" && (
                          <button className="icon-btn" title={t("reverseWriteOff")} disabled={busyId === r.id} onClick={() => handleReverse(r)}>
                            <Undo2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRequest && (
        <RequestModal onClose={() => setShowRequest(false)} onRequested={() => { setShowRequest(false); load(); }} t={t} showToast={showToast} />
      )}
    </div>
  );
}
