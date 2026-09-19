// Dormant-customer reactivation (targeting stage) and customer issue handling
// (issue stage) - two stages of the same case, see backend RetargetCase.
import { useEffect, useState, useCallback, Fragment } from "react";
import { Target, Check, X as XIcon, ClipboardList, Clock, AlertTriangle, MessageSquarePlus, Megaphone } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { pending: "warn", assigned: "teal", closed: "ok" };
const CATEGORIES = ["price", "quality", "service", "competitor", "inactive", "other"];

function AssignModal({ item, staffList, onClose, onDone, t, showToast }) {
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignee) return;
    setSaving(true);
    try {
      await api.assignRetargetCase(item.id, assignee);
      onDone();
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
        <h3>{t("assignRetargetTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("assignTo")}</label>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} autoFocus required>
            <option value="">{t("selectOption")}</option>
            {staffList.map((s) => <option key={s.username} value={s.username}>{s.full_name || s.username}</option>)}
          </select>
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!assignee || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportModal({ item, onClose, onDone, t, showToast }) {
  const [outcome, setOutcome] = useState("won");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (outcome === "no_sale" && !category) return;
    setSaving(true);
    try {
      await api.reportRetargetCase(item.id, { outcome, note: note.trim() || null, category: category || null });
      showToast(t("saved"), "success");
      onDone();
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
        <h3>{t("reportRetargetTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("outcomeLabel")}</label>
          <div className="quick-toggle-row">
            <button type="button" className={`quick-toggle-chip ${outcome === "won" ? "active" : ""}`} onClick={() => setOutcome("won")}>{t("outcomeWon")}</button>
            <button type="button" className={`quick-toggle-chip ${outcome === "no_sale" ? "active" : ""}`} onClick={() => setOutcome("no_sale")}>{t("outcomeNoSale")}</button>
          </div>
          {outcome === "no_sale" && (
            <>
              <label style={{ marginTop: 10, display: "block" }}>{t("retargetCategoryLabel")}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">{t("selectOption")}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`retargetCategory_${c}`)}</option>)}
              </select>
            </>
          )}
          <label style={{ marginTop: 10, display: "block" }}>{t("noteOptionalLabel")}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={saving || (outcome === "no_sale" && !category)}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolveModal({ item, onClose, onDone, t, showToast }) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [won, setWon] = useState(false);
  const [category, setCategory] = useState(item.category || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionNote.trim()) return;
    setSaving(true);
    try {
      await api.resolveRetargetCase(item.id, { resolution_note: resolutionNote.trim(), won, category: category || null });
      showToast(t("saved"), "success");
      onDone();
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
        <h3>{t("resolveRetargetTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label className="checkbox-inline">
            <input type="checkbox" checked={won} onChange={(e) => setWon(e.target.checked)} />
            {t("resolvedAsWon")}
          </label>
          <label style={{ marginTop: 10, display: "block" }}>{t("retargetCategoryLabel")}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("selectOption")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`retargetCategory_${c}`)}</option>)}
          </select>
          <label style={{ marginTop: 10, display: "block" }}>{t("resolutionNoteLabel")}</label>
          <textarea rows={3} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} autoFocus />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!resolutionNote.trim() || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUpModal({ item, onClose, onDone, t, showToast }) {
  const [note, setNote] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.addRetargetFollowUp(item.id, note.trim(), reminderDate || null);
      showToast(t("saved"), "success");
      onDone();
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
        <h3><MessageSquarePlus size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("addFollowUpTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("noteRequired")}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <label style={{ marginTop: 10, display: "block" }}>{t("reminderDateOptional")}</label>
          <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!note.trim() || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SnoozeModal({ item, onClose, onDone, t, showToast }) {
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!snoozeUntil) return;
    setSaving(true);
    try {
      await api.snoozeRetargetCase(item.id, snoozeUntil);
      showToast(t("saved"), "success");
      onDone();
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
        <h3><Clock size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("snoozeRetargetTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("snoozeUntilLabel")}</label>
          <input type="date" value={snoozeUntil} onChange={(e) => setSnoozeUntil(e.target.value)} autoFocus required />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!snoozeUntil || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUpsList({ caseId, t }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.retargetFollowUps(caseId).then(setRows).catch(() => setRows([])); }, [caseId]);
  if (!rows) return <div className="loading-state">{t("loadingDots")}</div>;
  if (rows.length === 0) return <div className="empty-state">{t("noActivity")}</div>;
  return (
    <div style={{ padding: 12 }}>
      {rows.map((f) => (
        <div key={f.id} style={{ marginBottom: 8, fontSize: 12.5 }}>
          <strong>{f.created_by}</strong> · {fmtDateTime(f.created_at)}
          {f.reminder_date && <> · {t("reminderDateOptional")}: {fmtDate(f.reminder_date)}</>}
          <div>{f.note}</div>
        </div>
      ))}
    </div>
  );
}

export default function RetargetingReport({ onSelectCustomer, role, username }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [stage, setStage] = useState("targeting");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);
  const [followUpModal, setFollowUpModal] = useState(null);
  const [snoozeModal, setSnoozeModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [savingPaymentTypeId, setSavingPaymentTypeId] = useState(null);
  const [eligibleOffers, setEligibleOffers] = useState([]);
  const [nominatingId, setNominatingId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.retargetCases({ stage, status: statusFilter, mine: mineOnly }).then(setRows).catch((e) => setError(e.message));
    api.retargetCasesSummary().then(setSummary).catch(() => {});
  }, [stage, statusFilter, mineOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (role === "admin") api.staffList().then(setStaffList).catch(() => {}); }, [role]);
  useEffect(() => { api.fieldOptions("payment_type").then(setPaymentTypeOptions).catch(() => {}); }, []);
  useEffect(() => {
    // Always scoped to offers the CURRENT user is actually a participant in
    // (this is what nominating will succeed against) - never just "any open
    // offer", since an admin browsing this screen isn't automatically a
    // participant of every offer either, and a blind pick that fails is
    // worse than not offering the button at all.
    api.myCollectionOffers().then((offers) => {
      setEligibleOffers((offers || []).filter((o) => o.status === "open"));
    }).catch(() => {});
  }, []);

  const savePaymentType = async (partnerId, value) => {
    setSavingPaymentTypeId(partnerId);
    try {
      await api.updatePaymentType(partnerId, value || null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingPaymentTypeId(null);
    }
  };

  const nominateForOffer = async (r, offer) => {
    setNominatingId(r.id);
    try {
      await api.nominateForCollectionOffer(offer.id, r.partner_id);
      showToast(`${t("nominationSubmitted")} - ${offer.name}`, "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setNominatingId(null);
    }
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Target size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("retargetingTitle")}</h2>
        <p className="panel-sub">{t("retargetingHint")}</p>

        {summary && (
          <div className="table-totals-row" style={{ marginTop: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="table-totals-item">{t("retargetSummaryTargetingOpen")}: <strong>{summary.targeting_open}</strong></span>
            <span className="table-totals-item">{t("retargetSummaryIssueOpen")}: <strong>{summary.issue_open}</strong></span>
            <span className="table-totals-item">{t("retargetSummaryEscalated")}: <strong>{summary.escalated_open}</strong></span>
            <span className="table-totals-item">{t("retargetSummaryWonThisMonth")}: <strong>{summary.won_this_month}</strong></span>
          </div>
        )}

        <div className="quick-toggle-row" style={{ marginBottom: 10 }}>
          <button className={`quick-toggle-chip ${stage === "targeting" ? "active" : ""}`} onClick={() => setStage("targeting")}>{t("retargetStageTargeting")}</button>
          <button className={`quick-toggle-chip ${stage === "issue" ? "active" : ""}`} onClick={() => setStage("issue")}>{t("retargetStageIssue")}</button>
        </div>

        <div className="quick-toggle-row" style={{ marginBottom: 14 }}>
          <button className={`quick-toggle-chip ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>{t("allStatus")}</button>
          {["pending", "assigned", "closed"].map((s) => (
            <button key={s} className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {t(`retargetStatus_${s}`)}
            </button>
          ))}
          <button className={`quick-toggle-chip ${mineOnly ? "active" : ""}`} onClick={() => setMineOnly((v) => !v)}>
            {t("myVisitsFilter")}
          </button>
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
                  <th>{stage === "targeting" ? t("lastPurchaseLabel") : t("visitReasonLabel")}</th>
                  <th>{t("status")}</th>
                  <th>{t("paymentTypeLabel")}</th>
                  <th>{t("retargetBranchLabel")}</th>
                  <th>{t("assignTo")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                        <span className="cust-name">{r.customer_name}</span>
                        {r.city && <div className="my-day-city">{r.city}</div>}
                        {r.escalated && (
                          <span className="fu-tag sm danger" style={{ marginTop: 4 }}>
                            <AlertTriangle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                            {t("retargetEscalatedBadge")} · {t("retargetAttemptNumber")} {r.attempt_number}
                          </span>
                        )}
                      </td>
                      <td data-label={t("balanceDue")}>{r.current_balance !== null ? <RiyalAmount amount={r.current_balance} /> : "—"}</td>
                      <td data-label={stage === "targeting" ? t("lastPurchaseLabel") : t("visitReasonLabel")}>
                        {stage === "targeting" ? (r.last_purchase_date ? fmtDate(r.last_purchase_date) : "—") : r.reason}
                        {r.category && <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{t(`retargetCategory_${r.category}`)}</div>}
                      </td>
                      <td data-label={t("status")}>
                        <span className={`fu-tag sm ${STATUS_TONE[r.status]}`}>{t(`retargetStatus_${r.status}`)}</span>
                        {r.outcome && <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{t(r.outcome === "won" ? "outcomeWon" : "outcomeNoSale")}</div>}
                      </td>
                      <td data-label={t("paymentTypeLabel")} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={r.payment_type || ""}
                          disabled={role !== "admin" || savingPaymentTypeId === r.partner_id}
                          onChange={(e) => savePaymentType(r.partner_id, e.target.value)}
                        >
                          <option value="">—</option>
                          {paymentTypeOptions.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
                        </select>
                      </td>
                      <td data-label={t("retargetBranchLabel")}>{r.top_branch || "—"}</td>
                      <td data-label={t("assignTo")}>{r.assigned_to || "—"}</td>
                      <td data-label={t("actions")}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {role === "admin" && r.status !== "closed" && (
                            <button className="icon-btn" title={t("assignRetargetTitle")} onClick={() => setAssignModal(r)}><Check size={13} /></button>
                          )}
                          {eligibleOffers.length === 1 && (
                            <button
                              className="icon-btn"
                              title={`${t("nominateForOffer")} - ${eligibleOffers[0].name}`}
                              disabled={nominatingId === r.id}
                              onClick={() => nominateForOffer(r, eligibleOffers[0])}
                            >
                              <Megaphone size={13} />
                            </button>
                          )}
                          {eligibleOffers.length > 1 && (
                            <select
                              className="sm"
                              title={t("nominateForOffer")}
                              disabled={nominatingId === r.id}
                              value=""
                              onChange={(e) => {
                                const offer = eligibleOffers.find((o) => String(o.id) === e.target.value);
                                if (offer) nominateForOffer(r, offer);
                              }}
                            >
                              <option value="" disabled>{t("nominateForOffer")}</option>
                              {eligibleOffers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          )}
                          {stage === "targeting" && r.status === "assigned" && (role === "admin" || r.assigned_to === username) && (
                            <button className="btn-secondary sm" onClick={() => setReportModal(r)}>{t("reportRetargetTitle")}</button>
                          )}
                          {stage === "issue" && r.status !== "closed" && (role === "admin" || r.assigned_to === username) && (
                            <button className="icon-btn" title={t("addFollowUpTitle")} onClick={() => setFollowUpModal(r)}><MessageSquarePlus size={13} /></button>
                          )}
                          {stage === "issue" && r.status !== "closed" && role === "admin" && (
                            <button className="btn-secondary sm" onClick={() => setResolveModal(r)}>{t("resolveRetargetTitle")}</button>
                          )}
                          {r.status !== "closed" && (role === "admin" || r.assigned_to === username) && (
                            <button className="icon-btn" title={t("snoozeRetargetTitle")} onClick={() => setSnoozeModal(r)}><Clock size={13} /></button>
                          )}
                          {stage === "issue" && (
                            <button className="icon-btn" title={t("viewDetails")} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                              <ClipboardList size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === r.id && stage === "issue" && (
                      <tr>
                        <td colSpan={8} style={{ background: "var(--card)" }}>
                          <FollowUpsList caseId={r.id} t={t} />
                          {r.resolution_note && (
                            <div style={{ padding: "0 12px 12px" }}>
                              <strong>{t("resolutionNoteLabel")}:</strong> {r.resolution_note}
                              <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{r.resolved_by} · {fmtDateTime(r.resolved_at)}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assignModal && (
        <AssignModal item={assignModal} staffList={staffList} onClose={() => setAssignModal(null)} onDone={() => { setAssignModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {reportModal && (
        <ReportModal item={reportModal} onClose={() => setReportModal(null)} onDone={() => { setReportModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {resolveModal && (
        <ResolveModal item={resolveModal} onClose={() => setResolveModal(null)} onDone={() => { setResolveModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {followUpModal && (
        <FollowUpModal item={followUpModal} onClose={() => setFollowUpModal(null)} onDone={() => { setFollowUpModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {snoozeModal && (
        <SnoozeModal item={snoozeModal} onClose={() => setSnoozeModal(null)} onDone={() => { setSnoozeModal(null); load(); }} t={t} showToast={showToast} />
      )}
    </div>
  );
}
