// Periodic balance-confirmation workflow: assign a customer to a collector
// for reconciliation; they confirm the balance matches (with proof + a next
// check-in date) or flag a discrepancy, which detours to a specialist and
// comes back to the same collector once resolved.
import { useEffect, useState, useCallback } from "react";
import { ClipboardCheck, Check, X as XIcon, AlertTriangle, FileText, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { unassigned: "faint", pending: "warn", issue: "danger", matched: "ok" };
const MONTH_OPTIONS = [1, 2, 3, 4];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AssignModal({ item, staffList, onClose, onDone, t, showToast }) {
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignee) return;
    setSaving(true);
    try {
      await api.assignReconciliation(item.partner_id, assignee);
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
        <h3>{t("assignReconciliationTitle")}</h3>
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

function MatchModal({ item, onClose, onDone, t, showToast }) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState(1);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewBalance, setPreviewBalance] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!asOfDate) { setPreviewBalance(null); return; }
    setPreviewLoading(true);
    api.reconciliationBalancePreview(item.case_id, asOfDate)
      .then((res) => setPreviewBalance(res.balance))
      .catch(() => setPreviewBalance(null))
      .finally(() => setPreviewLoading(false));
  }, [asOfDate, item.case_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!asOfDate || !file) return;
    setSaving(true);
    try {
      const dataUrl = await fileToBase64(file);
      await api.matchReconciliation(item.case_id, {
        as_of_date: asOfDate, next_reconciliation_months: months,
        proof_file_name: file.name, proof_file_type: file.type, proof_file_data: dataUrl,
      });
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
        <h3><Check size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("matchReconciliationTitle")}</h3>
        <p className="prompt-message">{item.customer_name} — <RiyalAmount amount={item.current_balance} /></p>
        <form onSubmit={handleSubmit}>
          <label>{t("asOfDateLabel")}</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
          {asOfDate && (
            <p className="prompt-message" style={{ marginTop: 6 }}>
              {t("reconciledBalanceLabel")}: {previewLoading ? t("loadingDots") : (
                previewBalance !== null ? <strong><RiyalAmount amount={previewBalance} /></strong> : "—"
              )}
            </p>
          )}
          <label style={{ marginTop: 10, display: "block" }}>{t("nextReconciliationMonthsLabel")}</label>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{t(`monthsOption_${m}`)}</option>)}
          </select>
          <label style={{ marginTop: 10, display: "block" }}>{t("proofFileLabel")}</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!asOfDate || !file || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueModal({ item, staffList, onClose, onDone, t, showToast }) {
  const [note, setNote] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim() || !specialist) return;
    setSaving(true);
    try {
      await api.flagReconciliationIssue(item.case_id, { issue_note: note.trim(), specialist_assigned_to: specialist });
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
        <h3><AlertTriangle size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("flagIssueTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("issueNoteLabel")}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus required />
          <label style={{ marginTop: 10, display: "block" }}>{t("specialistLabel")}</label>
          <select value={specialist} onChange={(e) => setSpecialist(e.target.value)} required>
            <option value="">{t("selectOption")}</option>
            {staffList.map((s) => <option key={s.username} value={s.username}>{s.full_name || s.username}</option>)}
          </select>
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary danger-btn" disabled={!note.trim() || !specialist || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolveModal({ item, onClose, onDone, t, showToast }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.resolveReconciliationIssue(item.case_id, note.trim());
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
        <h3>{t("resolveIssueTitle")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        {item.issue_note && (
          <p className="prompt-message" style={{ color: "var(--danger)" }}>{t("issueNoteLabel")}: {item.issue_note}</p>
        )}
        <form onSubmit={handleSubmit}>
          <label>{t("resolutionNoteLabel")}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus required />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!note.trim() || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReconciliationsReport({ onSelectCustomer, role, username }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [cities, setCities] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("current_due");
  const [sortDir, setSortDir] = useState("desc");
  const [assignModal, setAssignModal] = useState(null);
  const [matchModal, setMatchModal] = useState(null);
  const [issueModal, setIssueModal] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerType, setViewerType] = useState(null);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
    api.staffList().then(setStaffList).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.reconciliations({
      search, city: cityFilter, collector: collectorFilter, status: statusFilter, mine: mineOnly, page, page_size: 25,
      sort_by: sortBy, sort_dir: sortDir,
    }).then(setData).catch((e) => setError(e.message));
  }, [search, cityFilter, collectorFilter, statusFilter, mineOnly, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, cityFilter, collectorFilter, statusFilter, mineOnly, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir(field === "name" ? "asc" : "desc"); }
  };
  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="sort-icon idle" />;
    return sortDir === "asc" ? <ArrowUp size={11} className="sort-icon active" /> : <ArrowDown size={11} className="sort-icon active" />;
  };

  const viewProof = async (caseId) => {
    try {
      const { url, type } = await api.reconciliationProofFile(caseId);
      setViewerUrl(url);
      setViewerType(type);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || 25))) : 1;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><ClipboardCheck size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("reconciliationsTitle")}</h2>
        <p className="panel-sub">{t("reconciliationsHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("collectorField")}</label>
            <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {collectors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="quick-toggle-row" style={{ marginBottom: 14 }}>
          <button className={`quick-toggle-chip ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>{t("allStatus")}</button>
          {["unassigned", "pending", "issue", "matched"].map((s) => (
            <button key={s} className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {t(`reconciliationStatus_${s}`)}
            </button>
          ))}
          <button className={`quick-toggle-chip ${mineOnly ? "active" : ""}`} onClick={() => setMineOnly((v) => !v)}>
            {t("myVisitsFilter")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {data && data.results.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("name")}>{t("customer")} <SortIcon col="name" /></th>
                    <th className="sortable" onClick={() => toggleSort("current_due")}>{t("balanceDue")} <SortIcon col="current_due" /></th>
                    <th>{t("collectorField")}</th>
                    <th className="sortable" onClick={() => toggleSort("last_reconciliation_date")}>{t("lastReconciliationDate")} <SortIcon col="last_reconciliation_date" /></th>
                    <th className="sortable" onClick={() => toggleSort("reconciled_balance")}>{t("reconciledBalanceLabel")} <SortIcon col="reconciled_balance" /></th>
                    <th className="sortable" onClick={() => toggleSort("next_reconciliation_date")}>{t("nextReconciliationDate")} <SortIcon col="next_reconciliation_date" /></th>
                    <th>{t("status")}</th>
                    <th>{t("assignTo")}</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.partner_id}>
                      <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                        <span className="cust-name">{r.customer_name}</span>
                        {r.city && <div className="my-day-city">{r.city}</div>}
                      </td>
                      <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_balance} /></td>
                      <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                      <td data-label={t("lastReconciliationDate")}>{r.last_reconciliation_date ? fmtDate(r.last_reconciliation_date) : "—"}</td>
                      <td data-label={t("reconciledBalanceLabel")}>{r.reconciled_balance !== null && r.reconciled_balance !== undefined ? <RiyalAmount amount={r.reconciled_balance} /> : "—"}</td>
                      <td data-label={t("nextReconciliationDate")}>{r.next_reconciliation_date ? fmtDate(r.next_reconciliation_date) : "—"}</td>
                      <td data-label={t("status")}>
                        <span className={`fu-tag sm ${STATUS_TONE[r.case_status]}`}>{t(`reconciliationStatus_${r.case_status}`)}</span>
                      </td>
                      <td data-label={t("assignTo")}>
                        {r.case_status === "issue" ? (r.specialist_assigned_to || "—") : (r.assigned_to || "—")}
                      </td>
                      <td data-label={t("actions")}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {role === "admin" && r.case_status === "unassigned" && (
                            <button className="icon-btn" title={t("assignReconciliationTitle")} onClick={() => setAssignModal(r)}><Check size={13} /></button>
                          )}
                          {r.case_status === "pending" && (role === "admin" || r.assigned_to === username) && (
                            <>
                              <button className="btn-secondary sm" onClick={() => setMatchModal(r)}>{t("matchReconciliationTitle")}</button>
                              <button className="icon-btn" title={t("flagIssueTitle")} onClick={() => setIssueModal(r)}><AlertTriangle size={13} /></button>
                            </>
                          )}
                          {r.case_status === "issue" && (role === "admin" || r.specialist_assigned_to === username) && (
                            <button className="btn-secondary sm" onClick={() => setResolveModal(r)}>{t("resolveIssueTitle")}</button>
                          )}
                          {r.case_status === "matched" && r.case_id && (
                            <button className="icon-btn" title={t("viewProofButton")} onClick={() => viewProof(r.case_id)}><FileText size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
              <span className="page-info">{page} / {totalPages} · {data.total}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
            </div>
          </>
        )}
      </div>

      {assignModal && (
        <AssignModal item={assignModal} staffList={staffList} onClose={() => setAssignModal(null)} onDone={() => { setAssignModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {matchModal && (
        <MatchModal item={matchModal} onClose={() => setMatchModal(null)} onDone={() => { setMatchModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {issueModal && (
        <IssueModal item={issueModal} staffList={staffList} onClose={() => setIssueModal(null)} onDone={() => { setIssueModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {resolveModal && (
        <ResolveModal item={resolveModal} onClose={() => setResolveModal(null)} onDone={() => { setResolveModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {viewerUrl && (
        <div className="overlay modal-overlay" onClick={() => setViewerUrl(null)}>
          <div className="prompt-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setViewerUrl(null)}><XIcon size={16} /></button>
            {viewerType === "application/pdf" ? (
              <iframe src={viewerUrl} title="proof" style={{ width: "100%", height: "70vh", border: "none" }} />
            ) : (
              <img src={viewerUrl} alt="proof" style={{ width: "100%", borderRadius: 10 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
