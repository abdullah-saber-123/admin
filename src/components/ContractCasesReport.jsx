import { useEffect, useState } from "react";
import {
  FileSignature, Search, X, Plus, Check, Ban, Eye, Paperclip,
  FileText, CreditCard, CheckCircle2, Upload, User as UserIcon, IdCard, ShieldCheck,
} from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { pending_review: "warn", in_progress: "teal", archived: "ok", rejected: "danger" };
const STATUS_ACCENT = { pending_review: "amber", in_progress: "teal", archived: "ok", rejected: "danger" };
const STATUS_LIST = ["pending_review", "in_progress", "archived", "rejected"];
const TRACK_ICON = { note: FileText, contract: FileSignature, credit_limit: CreditCard, final: CheckCircle2 };
const DOC_LABEL_KEYS = {
  commercial_registration: "contractCaseDocCR",
  tax_certificate: "contractCaseDocTax",
  national_address: "contractCaseDocAddress",
  owner_id: "contractCaseDocOwnerId",
  authorized_person_id: "contractCaseDocAuthorizedId",
  other: "contractCaseDocOther",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileField({ label, required, value, onChange }) {
  const { t } = useLang();
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToBase64(file);
    onChange({ file_name: file.name, file_type: file.type, file_data: dataUrl });
  };
  return (
    <div className={`cc-file-field${required ? " required" : ""}`}>
      <label>
        <Upload size={12} />
        {label}{required ? <span className="req-star"> *</span> : <span className="settings-meta"> ({t("optional")})</span>}
      </label>
      <input type="file" onChange={handleFile} style={{ fontSize: 11.5, width: "100%" }} />
      {value?.file_name && (
        <div className="cc-doc-chip" style={{ marginTop: 6 }}>
          <Check size={11} />{value.file_name}
        </div>
      )}
    </div>
  );
}

function CreateCaseForm({ onCreated, onCancel }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [noteExempt, setNoteExempt] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerIdNumber, setOwnerIdNumber] = useState("");
  const [authorizedName, setAuthorizedName] = useState("");
  const [authorizedIdNumber, setAuthorizedIdNumber] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [docs, setDocs] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientSearch.trim()) { setClientOptions([]); return; }
    const timer = setTimeout(() => {
      api.customers({ search: clientSearch, page_size: 8 }).then((res) => setClientOptions(res.results || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const requiredDocsDone = docs.commercial_registration && docs.tax_certificate && docs.national_address;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!requiredDocsDone) {
      showToast(t("contractCaseMissingRequiredDocs"), "error");
      return;
    }
    setSaving(true);
    try {
      await api.createContractCase({
        partner_id: selectedClient.partner_id,
        credit_limit_requested: creditLimit ? Number(creditLimit) : null,
        note_exempt: noteExempt,
        owner_name: ownerName || null, owner_id_number: ownerIdNumber || null,
        authorized_person_name: authorizedName || null, authorized_person_id_number: authorizedIdNumber || null,
        commercial_registration_number: crNumber || null, tax_number: taxNumber || null,
        commercial_registration: docs.commercial_registration, tax_certificate: docs.tax_certificate,
        national_address: docs.national_address, owner_id: docs.owner_id || null,
        authorized_person_id: docs.authorized_person_id || null, other: docs.other || null,
      });
      showToast(t("contractCaseCreated"), "success");
      onCreated();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form" style={{ maxWidth: "none" }}>
      <div className="user-form-section">
        <div className="user-form-section-title"><UserIcon size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("contractCaseCustomerStep")}</div>
        <div className="more-filters-row">
          <div className="more-filter-field" style={{ position: "relative", minWidth: 280 }}>
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); if (selectedClient) setSelectedClient(null); }}
                placeholder={t("searchPlaceholder")}
              />
              {selectedClient && <button className="icon-btn" type="button" onClick={() => { setSelectedClient(null); setClientSearch(""); }}><X size={13} /></button>}
            </div>
            {clientOptions.length > 0 && !selectedClient && (
              <div className="client-search-dropdown">
                {clientOptions.map((c) => (
                  <button key={c.partner_id} type="button" onClick={() => { setSelectedClient(c); setClientSearch(c.name); setClientOptions([]); }}>{c.name}</button>
                ))}
              </div>
            )}
            {!selectedClient && <p className="user-form-section-hint" style={{ margin: "4px 0 0" }}>{t("contractCaseSelectCustomerFirst")}</p>}
          </div>
          <div className="more-filter-field">
            <label>{t("contractCaseCreditLimitRequested")}</label>
            <input type="number" step="0.01" className="cost-of-debt-input" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} style={{ width: 160 }} />
          </div>
          <label className="checkbox-inline" style={{ alignSelf: "flex-end", marginBottom: 8 }} onClick={() => setNoteExempt((v) => !v)}>
            <input type="checkbox" checked={noteExempt} readOnly />
            {t("contractCaseNoteExempt")}
          </label>
        </div>
      </div>

      <div className="user-form-section">
        <div className="user-form-section-title"><IdCard size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("contractCaseIdentityStep")}</div>
        <div className="more-filters-row">
          <div className="more-filter-field"><label>{t("contractCaseOwnerName")}</label><input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div className="more-filter-field"><label>{t("contractCaseOwnerIdNumber")}</label><input value={ownerIdNumber} onChange={(e) => setOwnerIdNumber(e.target.value)} /></div>
        </div>
        <div className="more-filters-row">
          <div className="more-filter-field"><label>{t("contractCaseAuthorizedName")}</label><input value={authorizedName} onChange={(e) => setAuthorizedName(e.target.value)} /></div>
          <div className="more-filter-field"><label>{t("contractCaseAuthorizedIdNumber")}</label><input value={authorizedIdNumber} onChange={(e) => setAuthorizedIdNumber(e.target.value)} /></div>
        </div>
        <div className="more-filters-row">
          <div className="more-filter-field"><label>{t("contractCaseCrNumber")}</label><input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} /></div>
          <div className="more-filter-field"><label>{t("contractCaseTaxNumber")}</label><input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} /></div>
        </div>
      </div>

      <div className="user-form-section">
        <div className="user-form-section-title"><FileText size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("contractCaseDocsStep")}</div>
        <p className="user-form-section-hint">{t("contractCaseRequiredDocsHint")}</p>
        <div className="more-filters-row">
          <FileField label={t("contractCaseDocCR")} required value={docs.commercial_registration} onChange={(v) => setDocs((d) => ({ ...d, commercial_registration: v }))} />
          <FileField label={t("contractCaseDocTax")} required value={docs.tax_certificate} onChange={(v) => setDocs((d) => ({ ...d, tax_certificate: v }))} />
          <FileField label={t("contractCaseDocAddress")} required value={docs.national_address} onChange={(v) => setDocs((d) => ({ ...d, national_address: v }))} />
        </div>
        <p className="user-form-section-hint" style={{ marginTop: 12 }}>{t("contractCaseOptionalDocsHint")}</p>
        <div className="more-filters-row">
          <FileField label={t("contractCaseDocOwnerId")} value={docs.owner_id} onChange={(v) => setDocs((d) => ({ ...d, owner_id: v }))} />
          <FileField label={t("contractCaseDocAuthorizedId")} value={docs.authorized_person_id} onChange={(v) => setDocs((d) => ({ ...d, authorized_person_id: v }))} />
          <FileField label={t("contractCaseDocOther")} value={docs.other} onChange={(v) => setDocs((d) => ({ ...d, other: v }))} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn-primary" type="submit" disabled={saving || !selectedClient}>{saving ? t("saving") : t("contractCaseSubmitRequest")}</button>
        <button className="btn-secondary" type="button" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function StepRow({ step, canDo, busy, onComplete }) {
  const { t } = useLang();
  const [attachment, setAttachment] = useState(null);
  const [showAttach, setShowAttach] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToBase64(file);
    setAttachment({ file_name: file.name, file_type: file.type, file_data: dataUrl });
  };

  const handleClick = () => {
    if (step.requires_attachment && !showAttach) { setShowAttach(true); return; }
    onComplete(step.id, attachment);
  };

  return (
    <div className="cc-step-row" style={{ flexWrap: "wrap" }}>
      <span className={`cc-step-dot${step.done ? " done" : ""}`}>{step.done ? <Check size={12} /> : ""}</span>
      <div className="cc-step-row-body">
        <div className="cc-step-name">{step.name}{step.requires_attachment && <Paperclip size={11} style={{ verticalAlign: -1, marginInlineStart: 4, color: "var(--text-dim)" }} />}</div>
        {step.assigned_username && <div className="cc-step-meta">{step.assigned_username}</div>}
        {step.done && <div className="cc-step-meta">{step.done_by} - {fmtDateTime(step.done_at)}</div>}
        {!step.done && step.requires_attachment && <div className="cc-step-meta">{t("contractCaseRequiresAttachment")}</div>}
      </div>
      {!step.done && (
        canDo ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {showAttach && (
              <input type="file" style={{ fontSize: 11, maxWidth: 160 }} onChange={handleFile} />
            )}
            <button className="btn-secondary sm" disabled={busy || (showAttach && !attachment)} onClick={handleClick}>
              {showAttach ? t("contractCaseAttachFinalFile") : t("contractCaseMarkDone")}
            </button>
          </div>
        ) : (
          <span className="fu-tag faint">{t("contractCasePending")}</span>
        )
      )}
    </div>
  );
}

function DocChip({ caseId, field, fileName, hasFile, missingLabel }) {
  const handleView = (e) => {
    e.stopPropagation();
    window.open(api.contractCaseDocumentUrl(caseId, field), "_blank");
  };
  if (!hasFile) return <span className="cc-doc-chip missing"><X size={11} />{missingLabel}</span>;
  return (
    <button type="button" className="cc-doc-chip" onClick={handleView} style={{ cursor: "pointer", border: "none" }}>
      <Eye size={11} />{fileName}
    </button>
  );
}

function EditRequestForm({ c, caseId, onSaved, onCancel }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [creditLimit, setCreditLimit] = useState(c.credit_limit_requested ?? "");
  const [noteExempt, setNoteExempt] = useState(!!c.note_exempt);
  const [ownerName, setOwnerName] = useState(c.owner_name || "");
  const [ownerIdNumber, setOwnerIdNumber] = useState(c.owner_id_number || "");
  const [authorizedName, setAuthorizedName] = useState(c.authorized_person_name || "");
  const [authorizedIdNumber, setAuthorizedIdNumber] = useState(c.authorized_person_id_number || "");
  const [crNumber, setCrNumber] = useState(c.commercial_registration_number || "");
  const [taxNumber, setTaxNumber] = useState(c.tax_number || "");
  const [docs, setDocs] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.editContractCaseRequest(caseId, {
        credit_limit_requested: creditLimit === "" ? null : Number(creditLimit),
        note_exempt: noteExempt,
        owner_name: ownerName || null, owner_id_number: ownerIdNumber || null,
        authorized_person_name: authorizedName || null, authorized_person_id_number: authorizedIdNumber || null,
        commercial_registration_number: crNumber || null, tax_number: taxNumber || null,
        commercial_registration: docs.commercial_registration || null, tax_certificate: docs.tax_certificate || null,
        national_address: docs.national_address || null, owner_id: docs.owner_id || null,
        authorized_person_id: docs.authorized_person_id || null, other: docs.other || null,
      });
      showToast(t("contractCaseRequestUpdated"), "success");
      onSaved();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cc-track" style={{ marginTop: 12 }}>
      <div className="cc-track-title"><IdCard size={14} style={{ color: "var(--primary)" }} />{t("contractCaseEditRequest")}</div>
      <p className="user-form-section-hint">{t("contractCaseEditRequestHint")}</p>
      <div className="more-filters-row">
        <div className="more-filter-field">
          <label>{t("contractCaseCreditLimitRequested")}</label>
          <input type="number" step="0.01" className="cost-of-debt-input" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} style={{ width: 160 }} />
        </div>
        <label className="checkbox-inline" style={{ alignSelf: "flex-end", marginBottom: 8 }} onClick={() => setNoteExempt((v) => !v)}>
          <input type="checkbox" checked={noteExempt} readOnly />
          {t("contractCaseNoteExempt")}
        </label>
      </div>
      <div className="more-filters-row">
        <div className="more-filter-field"><label>{t("contractCaseOwnerName")}</label><input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
        <div className="more-filter-field"><label>{t("contractCaseOwnerIdNumber")}</label><input value={ownerIdNumber} onChange={(e) => setOwnerIdNumber(e.target.value)} /></div>
      </div>
      <div className="more-filters-row">
        <div className="more-filter-field"><label>{t("contractCaseAuthorizedName")}</label><input value={authorizedName} onChange={(e) => setAuthorizedName(e.target.value)} /></div>
        <div className="more-filter-field"><label>{t("contractCaseAuthorizedIdNumber")}</label><input value={authorizedIdNumber} onChange={(e) => setAuthorizedIdNumber(e.target.value)} /></div>
      </div>
      <div className="more-filters-row">
        <div className="more-filter-field"><label>{t("contractCaseCrNumber")}</label><input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} /></div>
        <div className="more-filter-field"><label>{t("contractCaseTaxNumber")}</label><input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} /></div>
      </div>
      <p className="user-form-section-hint" style={{ marginTop: 10 }}>{t("contractCaseReplaceFile")}</p>
      <div className="more-filters-row">
        <FileField label={t("contractCaseDocCR")} value={docs.commercial_registration} onChange={(v) => setDocs((d) => ({ ...d, commercial_registration: v }))} />
        <FileField label={t("contractCaseDocTax")} value={docs.tax_certificate} onChange={(v) => setDocs((d) => ({ ...d, tax_certificate: v }))} />
        <FileField label={t("contractCaseDocAddress")} value={docs.national_address} onChange={(v) => setDocs((d) => ({ ...d, national_address: v }))} />
      </div>
      <div className="more-filters-row" style={{ marginTop: 8 }}>
        <FileField label={t("contractCaseDocOwnerId")} value={docs.owner_id} onChange={(v) => setDocs((d) => ({ ...d, owner_id: v }))} />
        <FileField label={t("contractCaseDocAuthorizedId")} value={docs.authorized_person_id} onChange={(v) => setDocs((d) => ({ ...d, authorized_person_id: v }))} />
        <FileField label={t("contractCaseDocOther")} value={docs.other} onChange={(v) => setDocs((d) => ({ ...d, other: v }))} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn-primary sm" type="submit" disabled={saving}>{saving ? t("saving") : t("save")}</button>
        <button className="btn-secondary sm" type="button" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function CaseDetail({ caseId, onClose, onChanged, session }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitValue, setLimitValue] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [noteExpiryDate, setNoteExpiryDate] = useState("");

  const load = () => {
    api.getContractCase(caseId).then((data) => {
      setC(data);
      setContractNumber(data.contract_number || "");
      setContractDate(data.contract_date || "");
      setNoteExpiryDate(data.note_expiry_date || "");
    }).catch((e) => setError(e.message));
  };
  useEffect(load, [caseId]);

  const handleSaveLimit = async () => {
    if (limitValue === "" || Number.isNaN(Number(limitValue))) return;
    setBusy(true);
    try {
      await api.updateContractCaseDetails(caseId, { credit_limit_approved: Number(limitValue) });
      load();
      onChanged?.();
      setEditingLimit(false);
      showToast(t("contractCaseCreditLimitUpdated"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDetails = async () => {
    setBusy(true);
    try {
      await api.updateContractCaseDetails(caseId, {
        contract_number: contractNumber || null, contract_date: contractDate || null, note_expiry_date: noteExpiryDate || null,
      });
      load();
      onChanged?.();
      setEditingDetails(false);
      showToast(t("contractCaseDetailsUpdated"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const canDoStep = (step) => !step.done && (session.role === "admin" || step.assigned_username === session.username);

  const handleCompleteStep = async (stepId, attachment) => {
    setBusy(true);
    try {
      await api.completeApprovalStep(caseId, stepId, "", attachment);
      load();
      onChanged?.();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveReview = async () => {
    setBusy(true);
    try {
      await api.approveContractCaseReview(caseId);
      load();
      onChanged?.();
      showToast(t("contractCaseReviewApproved"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) return;
    setBusy(true);
    try {
      await api.rejectContractCase(caseId, rejectNote.trim());
      load();
      onChanged?.();
      setShowReject(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTemplate = () => {
    window.open(api.contractCaseTemplateUrl(caseId), "_blank");
  };

  if (error) return <div className="error-state">{error}</div>;
  if (!c) return <div className="loading-state">{t("loadingDots")}</div>;

  const byTrack = { note: [], contract: [], credit_limit: [], final: [] };
  (c.steps || []).forEach((s) => byTrack[s.track]?.push(s));

  const docEntries = Object.entries(c.documents || {});
  const doneSteps = (c.steps || []).filter((s) => s.done).length;
  const totalSteps = (c.steps || []).length;
  const isClosed = ["rejected", "archived"].includes(c.status);

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 className="insights-chart-title">{c.customer_name}</h3>
          <span className={`fu-tag ${STATUS_TONE[c.status]}`}>{t(`contractCaseStatus_${c.status}`)}</span>
          {c.last_edited_by && (
            <p className="settings-meta" style={{ margin: "4px 0 0" }}>
              {t("contractCaseLastEditedBy")}: {c.last_edited_by} - {fmtDateTime(c.last_edited_at)}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary sm" onClick={handleOpenTemplate}>
            <FileSignature size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseOpenTemplate")}
          </button>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
      </div>

      {c.status === "pending_review" && (session.role === "admin" || session.username === c.requested_by) && (
        <div className="cc-track" style={{ borderColor: "var(--warn)", marginTop: 12 }}>
          <div className="cc-track-title"><ShieldCheck size={14} style={{ color: "var(--warn)" }} />{t("contractCasePendingReviewHint")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {session.role === "admin" && (
              <button className="btn-primary sm" disabled={busy} onClick={handleApproveReview}>
                <Check size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseApproveReview")}
              </button>
            )}
            <button className="btn-secondary sm" onClick={() => setShowEditRequest((v) => !v)}>
              <IdCard size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseEditRequest")}
            </button>
            {session.role === "admin" && (
              !showReject ? (
                <button className="btn-secondary sm danger" onClick={() => setShowReject(true)}><Ban size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseReject")}</button>
              ) : (
                <div className="more-filters-row" style={{ margin: 0 }}>
                  <div className="more-filter-field" style={{ flex: 1 }}><input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t("contractCaseRejectReason")} /></div>
                  <button className="btn-secondary sm danger" disabled={busy} onClick={handleReject}>{t("contractCaseReject")}</button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {showEditRequest && (
        <EditRequestForm
          c={c} caseId={caseId}
          onSaved={() => { setShowEditRequest(false); load(); onChanged?.(); }}
          onCancel={() => setShowEditRequest(false)}
        />
      )}

      <div className="insights-kpi-grid" style={{ marginTop: 12 }}>
        <div className="insights-kpi-card accent-amber">
          <div className="insights-kpi-top">
            <span className="insights-kpi-label">{t("contractCaseCreditLimitRequested")}</span>
            <span className="insights-kpi-icon"><CreditCard size={14} /></span>
          </div>
          <div className="insights-kpi-value insights-kpi-value-sm"><RiyalAmount amount={c.credit_limit_requested} /></div>
        </div>
        {(() => {
          const canEditLimit = session.role === "admin" && !c.credit_limit_applied && !isClosed;
          if (!canEditLimit && c.credit_limit_approved == null) return null;
          return (
            <div className="insights-kpi-card accent-ok">
              <div className="insights-kpi-top">
                <span className="insights-kpi-label">{t("contractCaseCreditLimitApproved")}</span>
                <span className="insights-kpi-icon"><CheckCircle2 size={14} /></span>
              </div>
              {editingLimit ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                  <input type="number" step="0.01" className="cost-of-debt-input" style={{ width: 110 }} autoFocus
                    value={limitValue} onChange={(e) => setLimitValue(e.target.value)} />
                  <button className="icon-btn" disabled={busy} onClick={handleSaveLimit}><Check size={13} /></button>
                  <button className="icon-btn" disabled={busy} onClick={() => setEditingLimit(false)}><X size={13} /></button>
                </div>
              ) : (
                <div className="insights-kpi-value insights-kpi-value-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RiyalAmount amount={c.credit_limit_approved ?? c.credit_limit_requested} />
                  {canEditLimit && (
                    <button
                      type="button"
                      className="btn-secondary sm"
                      style={{ fontSize: 10, padding: "2px 7px" }}
                      onClick={() => { setLimitValue(String(c.credit_limit_approved ?? c.credit_limit_requested ?? "")); setEditingLimit(true); }}
                    >
                      {t("contractCaseEditCreditLimit")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        <div className="insights-kpi-card accent-teal">
          <div className="insights-kpi-top">
            <span className="insights-kpi-label">{t("contractCaseProgress")}</span>
            <span className="insights-kpi-icon"><FileSignature size={14} /></span>
          </div>
          <div className="insights-kpi-value insights-kpi-value-sm">{doneSteps} / {totalSteps}</div>
        </div>
        <div className="insights-kpi-card accent-violet">
          <div className="insights-kpi-top">
            <span className="insights-kpi-label">{t("contractCaseNoteExempt")}</span>
            <span className="insights-kpi-icon"><FileText size={14} /></span>
          </div>
          <div className="insights-kpi-value insights-kpi-value-sm">{c.note_exempt ? t("yes") : t("no")}</div>
        </div>
      </div>

      {["note", "contract", "credit_limit", "final"].map((track) => (
        byTrack[track].length > 0 && (
          <div key={track} className="cc-track">
            <div className="cc-track-title">
              {(() => { const Icon = TRACK_ICON[track]; return <Icon size={14} style={{ color: "var(--primary)" }} />; })()}
              {t(`approvalTrack_${track}`)}
              <span className="cc-track-count">({byTrack[track].filter((s) => s.done).length}/{byTrack[track].length})</span>
            </div>
            {byTrack[track].map((s) => (
              <StepRow key={s.id} step={s} canDo={canDoStep(s)} busy={busy} onComplete={handleCompleteStep} />
            ))}
          </div>
        )
      ))}

      <div className="user-form-section">
        <div className="user-form-section-title">{t("contractCaseDocuments")}</div>
        <div className="cc-doc-grid">
          {docEntries.map(([k, v]) => (
            <DocChip key={k} caseId={caseId} field={k} fileName={v.file_name} hasFile={v.has_file} missingLabel={t(DOC_LABEL_KEYS[k] || k)} />
          ))}
        </div>
      </div>

      <div className="user-form-section">
        <div className="user-form-section-title">{t("contractCaseFinalDocs")}</div>
        {c.signed_contract_file_name || c.signed_note_file_name ? (
          <div className="cc-doc-grid">
            {c.signed_contract_file_name && <DocChip caseId={caseId} field="signed_contract" fileName={c.signed_contract_file_name} hasFile />}
            {!c.note_exempt && c.signed_note_file_name && <DocChip caseId={caseId} field="signed_note" fileName={c.signed_note_file_name} hasFile />}
          </div>
        ) : (
          <p className="settings-meta">{t("contractCaseNoFinalDocsYet")}</p>
        )}
      </div>

      {session.role === "admin" && !isClosed && c.status !== "pending_review" && (
        <div className="user-form-section">
          <div className="user-form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {t("contractCaseEditDetails")}
            {!editingDetails && <button className="btn-secondary sm" onClick={() => setEditingDetails(true)}>{t("contractCaseEditDetails")}</button>}
          </div>
          {editingDetails && (
            <>
              <div className="more-filters-row">
                <div className="more-filter-field"><label>{t("contractCaseContractNumber")}</label><input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} /></div>
                <div className="more-filter-field"><label>{t("contractCaseContractDate")}</label><input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} /></div>
                {!c.note_exempt && <div className="more-filter-field"><label>{t("contractCaseNoteExpiryDate")}</label><input type="date" value={noteExpiryDate} onChange={(e) => setNoteExpiryDate(e.target.value)} /></div>}
              </div>
              <button className="btn-primary sm" style={{ marginTop: 8 }} disabled={busy} onClick={handleSaveDetails}>{t("contractCaseSaveDetails")}</button>
            </>
          )}
        </div>
      )}

      {c.status === "in_progress" && session.role === "admin" && (
        <div className="user-form-section">
          {!showReject ? (
            <button className="btn-secondary sm danger" onClick={() => setShowReject(true)}><Ban size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseReject")}</button>
          ) : (
            <div className="more-filters-row">
              <div className="more-filter-field" style={{ flex: 1 }}><input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t("contractCaseRejectReason")} /></div>
              <button className="btn-secondary sm danger" disabled={busy} onClick={handleReject}>{t("contractCaseReject")}</button>
            </div>
          )}
        </div>
      )}
      {c.status === "rejected" && <p className="error-state">{c.rejection_note}</p>}
    </div>
  );
}

export default function ContractCasesReport({ session }) {
  const { t } = useLang();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState(null);
  const [allCases, setAllCases] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "create"
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  const load = () => {
    api.listContractCases({ status: statusFilter, search }).then(setCases).catch((e) => setError(e.message));
  };
  const loadStats = () => {
    api.listContractCases({}).then(setAllCases).catch(() => {});
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, search]);

  useEffect(loadStats, []);

  const handleChanged = () => { load(); loadStats(); };

  const counts = {};
  STATUS_LIST.forEach((s) => { counts[s] = (allCases || []).filter((c) => c.status === s).length; });

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><FileSignature size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("contractCasesTitle")}</h2>
            <p className="panel-sub">{t("contractCasesHint")}</p>
          </div>
          {mode === "list" && (
            <button className="btn-primary sm" onClick={() => setMode("create")}>
              <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseNewRequest")}
            </button>
          )}
        </div>

        {mode === "create" && (
          <div style={{ marginTop: 14 }}>
            <CreateCaseForm onCreated={() => { setMode("list"); handleChanged(); }} onCancel={() => setMode("list")} />
          </div>
        )}

        {mode === "list" && (
          <>
            {allCases && allCases.length > 0 && (
              <div className="insights-kpi-grid" style={{ marginTop: 14 }}>
                {STATUS_LIST.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`insights-kpi-card clickable accent-${STATUS_ACCENT[s]}${statusFilter === s ? " kpi-active" : ""}`}
                    style={{ textAlign: "start", border: "1px solid var(--border)", cursor: "pointer" }}
                    onClick={() => setStatusFilter((cur) => (cur === s ? "" : s))}
                  >
                    <div className="insights-kpi-top">
                      <span className="insights-kpi-label">{t(`contractCaseStatus_${s}`)}</span>
                    </div>
                    <div className="insights-kpi-value">{counts[s]}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="more-filters-row" style={{ marginTop: 4, marginBottom: 14 }}>
              <div className="more-filter-field">
                <div className="input-icon compact"><Search size={13} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} /></div>
              </div>
              <div className="more-filter-field">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{t("allStatus")}</option>
                  {STATUS_LIST.map((s) => <option key={s} value={s}>{t(`contractCaseStatus_${s}`)}</option>)}
                </select>
              </div>
            </div>

            {error && <div className="error-state">{error}</div>}
            {!error && !cases && <div className="loading-state">{t("loadingDots")}</div>}
            {cases && cases.length === 0 && <div className="empty-state">{t("contractCaseNoCases")}</div>}

            {cases && cases.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("customer")}</th>
                      <th>{t("status")}</th>
                      <th>{t("contractCaseCreditLimitRequested")}</th>
                      <th>{t("requestedBy")}</th>
                      <th>{t("date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="clickable-row" onClick={() => setSelectedCaseId(c.id)}>
                        <td data-label={t("customer")}>{c.customer_name}</td>
                        <td data-label={t("status")}><span className={`fu-tag ${STATUS_TONE[c.status]}`}>{t(`contractCaseStatus_${c.status}`)}</span></td>
                        <td data-label={t("contractCaseCreditLimitRequested")}><RiyalAmount amount={c.credit_limit_requested} /></td>
                        <td data-label={t("requestedBy")}>{c.requested_by}</td>
                        <td data-label={t("date")}>{fmtDate(c.requested_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedCaseId && (
              <CaseDetail caseId={selectedCaseId} session={session} onClose={() => setSelectedCaseId(null)} onChanged={handleChanged} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
