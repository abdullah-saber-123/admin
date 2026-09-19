// Periodic balance-confirmation workflow: assign a customer to a collector
// for reconciliation; they confirm the balance matches (with proof + a next
// check-in date) or flag a discrepancy, which detours to a specialist and
// comes back to the same collector once resolved.
import { useEffect, useState, useCallback } from "react";
import { ClipboardCheck, Check, X as XIcon, AlertTriangle, FileText, Search, ArrowUp, ArrowDown, ArrowUpDown, History, Download, MessageCircle, Printer } from "lucide-react";
import { api, BASE } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { unassigned: "faint", pending: "warn", issue: "danger", matched: "ok" };
const MONTH_OPTIONS = [1, 2, 3, 4];

function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

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
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim() || !specialist) return;
    setSaving(true);
    try {
      const payload = { issue_note: note.trim(), specialist_assigned_to: specialist };
      if (file) {
        payload.issue_file_name = file.name;
        payload.issue_file_type = file.type;
        payload.issue_file_data = await fileToBase64(file);
      }
      await api.flagReconciliationIssue(item.case_id, payload);
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
          <label style={{ marginTop: 10, display: "block" }}>{t("attachmentOptionalLabel")}</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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

function ConfirmationFormModal({ item, onClose, t, showToast, lang }) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewBalance, setPreviewBalance] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!asOfDate) { setPreviewBalance(null); return; }
    setPreviewLoading(true);
    api.reconciliationBalancePreview(item.case_id, asOfDate)
      .then((res) => setPreviewBalance(res.balance))
      .catch(() => setPreviewBalance(null))
      .finally(() => setPreviewLoading(false));
  }, [asOfDate, item.case_id]);

  const download = async () => {
    if (!asOfDate) return;
    setDownloading(true);
    try {
      await api.reconciliationConfirmationPdf(item.case_id, asOfDate, lang);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        <h3><Printer size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("downloadConfirmationForm")}</h3>
        <p className="prompt-message">{item.customer_name}</p>
        <label>{t("asOfDateLabel")}</label>
        <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
        {asOfDate && (
          <p className="prompt-message" style={{ marginTop: 6 }}>
            {t("reconciledBalanceLabel")}: {previewLoading ? t("loadingDots") : (
              previewBalance !== null ? <strong><RiyalAmount amount={previewBalance} /></strong> : "—"
            )}
          </p>
        )}
        <div className="prompt-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
          <button type="button" className="btn-primary" disabled={!asOfDate || downloading} onClick={download}>
            {downloading ? t("loadingDots") : t("downloadButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SendStatementModal({ item, onClose, onDone, t, showToast, lang }) {
  const [template, setTemplate] = useState(t("reconciliationStatementTemplate"));
  const [link, setLink] = useState("");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    api.statementLinks([item.partner_id]).then((map) => {
      const token = map[item.partner_id];
      setLink(token ? `${BASE}/api/public/statement/${token}` : "");
    }).catch(() => {});
  }, [item.partner_id]);

  const message = template
    .replace("{name}", item.customer_name || "")
    .replace("{balance}", (item.current_balance ?? 0).toLocaleString());
  const fullMessage = link ? `${message}\n\n${t("statementLinkLabel")}: ${link}` : message;

  const sendAndMark = async () => {
    window.open(`${waLink(item.phone)}?text=${encodeURIComponent(fullMessage)}`, "_blank");
    setMarking(true);
    try {
      await api.setReconciliationStatementSent(item.case_id, true);
      showToast(t("saved"), "success");
      onDone();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        <h3>{t("sendStatementTitle")}</h3>
        <div className="my-day-city" style={{ marginBottom: 10 }}>
          {item.customer_name} · <bdi dir="ltr">{item.phone}</bdi>
        </div>
        <label>{t("messageTemplate")}</label>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={{
            width: "100%", minHeight: 90, background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 9, color: "var(--text)", padding: 10, fontSize: 13, fontFamily: "inherit", marginTop: 6,
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-faint)", margin: "4px 0 12px" }}>{"{name}"} / {"{balance}"}</div>
        <div style={{
          fontSize: 12.5, background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 10, marginBottom: 14, whiteSpace: "pre-wrap",
        }}>
          {fullMessage}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" disabled={!item.phone || marking} onClick={sendAndMark}>
            <MessageCircle size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
            {t("openWhatsApp")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
        </div>
        {!item.phone && <div className="form-error" style={{ marginTop: 10 }}>{t("noPhoneNumber")}</div>}
      </div>
    </div>
  );
}

function HistoryModal({ item, onClose, t, showToast }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerType, setViewerType] = useState(null);

  useEffect(() => {
    api.reconciliationHistory(item.partner_id).then(setRows).catch((e) => setError(e.message));
  }, [item.partner_id]);

  const view = async (loader, caseId) => {
    try {
      const { url, type } = await loader(caseId);
      setViewerUrl(url);
      setViewerType(type);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const download = async (loader, caseId) => {
    try {
      await loader(caseId);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        <h3>{t("reconciliationHistoryTitle")}</h3>
        <div className="my-day-city" style={{ marginBottom: 10 }}>{item.customer_name}</div>
        {error && <div className="form-error">{error}</div>}
        {!rows && !error && <div className="loading-state">{t("loadingDots")}</div>}
        {rows && rows.length === 0 && <div className="empty-state">{t("noReconciliationHistory")}</div>}
        {rows && rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
            {rows.map((r) => (
              <div key={r.id} className="panel" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span className={`fu-tag sm ${STATUS_TONE[r.status]}`}>{t(`reconciliationStatus_${r.status}`)}</span>
                  <span className="my-day-city">{fmtDate(r.created_at)}</span>
                </div>
                <div style={{ marginTop: 4 }}>{t("assignTo")}: {r.assigned_to || "—"}</div>
                {r.status === "issue" && r.specialist_assigned_to && (
                  <div>{t("specialistLabel")}: {r.specialist_assigned_to}</div>
                )}
                {r.status === "matched" && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div>{t("asOfDateLabel")}: {r.as_of_date ? fmtDate(r.as_of_date) : "—"}</div>
                    <div>{t("reconciledBalanceLabel")}: {r.reconciled_balance !== null ? <RiyalAmount amount={r.reconciled_balance} /> : "—"}</div>
                    <div>{t("nextReconciliationDate")}: {r.next_reconciliation_date ? fmtDate(r.next_reconciliation_date) : "—"}</div>
                  </div>
                )}
                {r.issue_note && (
                  <div style={{ marginTop: 8 }}>
                    <div><strong>{t("issueNoteLabel")}</strong>: {r.issue_note}</div>
                    {r.resolution_note && <div><strong>{t("resolutionReplyLabel")}</strong>: {r.resolution_note}</div>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {r.has_proof && (
                    <>
                      <button className="btn-secondary sm" onClick={() => view(api.reconciliationProofFile, r.id)}><FileText size={13} /> {t("viewProofButton")}</button>
                      <button className="icon-btn" title={t("downloadButton")} onClick={() => download(api.reconciliationProofDownload, r.id)}><Download size={13} /></button>
                    </>
                  )}
                  {r.has_issue_file && (
                    <>
                      <button className="btn-secondary sm" onClick={() => view(api.reconciliationIssueFile, r.id)}><FileText size={13} /> {t("viewAttachmentButton")}</button>
                      <button className="icon-btn" title={t("downloadButton")} onClick={() => download(api.reconciliationIssueFileDownload, r.id)}><Download size={13} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {viewerUrl && (
          <div className="overlay modal-overlay" onClick={() => setViewerUrl(null)}>
            <div className="prompt-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setViewerUrl(null)}><XIcon size={16} /></button>
              {viewerType === "application/pdf" ? (
                <iframe src={viewerUrl} title="attachment" style={{ width: "100%", height: "60vh", border: "none" }} />
              ) : (
                <img src={viewerUrl} alt="attachment" style={{ width: "100%", borderRadius: 10 }} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResolveModal({ item, onClose, onDone, t, showToast }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerType, setViewerType] = useState(null);

  const viewIssueFile = async () => {
    try {
      const { url, type } = await api.reconciliationIssueFile(item.case_id);
      setViewerUrl(url);
      setViewerType(type);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

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
          <div style={{ background: "var(--card)", borderRadius: 10, padding: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>{t("issueNoteLabel")}</div>
            <p className="prompt-message" style={{ margin: 0 }}>{item.issue_note}</p>
            {item.has_issue_file && (
              <button type="button" className="btn-secondary sm" style={{ marginTop: 8 }} onClick={viewIssueFile}>
                {t("viewAttachmentButton")}
              </button>
            )}
          </div>
        )}
        {viewerUrl && (
          <div style={{ marginBottom: 10 }}>
            {viewerType === "application/pdf" ? (
              <iframe src={viewerUrl} title="issue-attachment" style={{ width: "100%", height: "40vh", border: "none" }} />
            ) : (
              <img src={viewerUrl} alt="issue-attachment" style={{ width: "100%", borderRadius: 10 }} />
            )}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={{ fontWeight: 700 }}>{t("resolutionReplyLabel")}</label>
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
  const { t, lang } = useLang();
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
  const [historyModal, setHistoryModal] = useState(null);
  const [sendStatementModal, setSendStatementModal] = useState(null);
  const [confirmationFormModal, setConfirmationFormModal] = useState(null);
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

  const toggleStatementSent = async (caseId, sent) => {
    try {
      await api.setReconciliationStatementSent(caseId, sent);
      load();
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
                    <th className="sortable" onClick={() => toggleSort("as_of_date")}>{t("asOfDateLabel")} <SortIcon col="as_of_date" /></th>
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
                      <td data-label={t("asOfDateLabel")}>{r.as_of_date ? fmtDate(r.as_of_date) : "—"}</td>
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
                          {role === "admin" && (r.case_status === "unassigned" || r.case_status === "matched") && (
                            <button className="icon-btn" title={t("assignReconciliationTitle")} onClick={() => setAssignModal(r)}><Check size={13} /></button>
                          )}
                          {r.case_status === "pending" && (role === "admin" || r.assigned_to === username) && (
                            <>
                              <button className="btn-secondary sm" onClick={() => setMatchModal(r)}>{t("matchReconciliationTitle")}</button>
                              <button className="icon-btn" title={t("flagIssueTitle")} onClick={() => setIssueModal(r)}><AlertTriangle size={13} /></button>
                              <button className="icon-btn" title={t("sendStatementButton")} onClick={() => setSendStatementModal(r)}><MessageCircle size={13} /></button>
                              <button className="icon-btn" title={t("downloadConfirmationForm")} onClick={() => setConfirmationFormModal(r)}><Printer size={13} /></button>
                              <label className="checkbox-inline" title={t("statementSentLabel")} style={{ fontSize: 11 }}>
                                <input
                                  type="checkbox"
                                  checked={!!r.statement_sent}
                                  onChange={(e) => toggleStatementSent(r.case_id, e.target.checked)}
                                />
                                {t("statementSentLabel")}
                              </label>
                            </>
                          )}
                          {r.case_status === "issue" && (role === "admin" || r.specialist_assigned_to === username) && (
                            <button className="btn-secondary sm" onClick={() => setResolveModal(r)}>{t("resolveIssueTitle")}</button>
                          )}
                          {r.case_status === "matched" && r.case_id && (
                            <button className="icon-btn" title={t("viewProofButton")} onClick={() => viewProof(r.case_id)}><FileText size={13} /></button>
                          )}
                          {r.case_status !== "unassigned" && (
                            <button className="icon-btn" title={t("reconciliationHistoryButton")} onClick={() => setHistoryModal(r)}><History size={13} /></button>
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
      {historyModal && (
        <HistoryModal item={historyModal} onClose={() => setHistoryModal(null)} t={t} showToast={showToast} />
      )}
      {sendStatementModal && (
        <SendStatementModal
          item={sendStatementModal} lang={lang}
          onClose={() => setSendStatementModal(null)}
          onDone={() => { setSendStatementModal(null); load(); }}
          t={t} showToast={showToast}
        />
      )}
      {confirmationFormModal && (
        <ConfirmationFormModal
          item={confirmationFormModal} lang={lang}
          onClose={() => setConfirmationFormModal(null)}
          t={t} showToast={showToast}
        />
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
