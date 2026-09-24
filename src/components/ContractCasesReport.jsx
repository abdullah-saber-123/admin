import { useEffect, useState } from "react";
import { FileSignature, Search, X, Plus, Check, Ban, Send, Archive } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate, fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { in_progress: "warn", ready_to_send: "teal", sent: "violet", archived: "ok", rejected: "danger" };

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
    <div className="more-filter-field" style={{ minWidth: 220 }}>
      <label>{label}{required ? " *" : ` (${t("optional")})`}</label>
      <input type="file" onChange={handleFile} />
      {value?.file_name && <p className="settings-meta" style={{ marginTop: 2 }}>{value.file_name}</p>}
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!docs.commercial_registration || !docs.tax_certificate || !docs.national_address) {
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
      <div className="more-filter-field" style={{ position: "relative", minWidth: 280, marginBottom: 14 }}>
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
      </div>

      <div className="more-filters-row" style={{ marginBottom: 14 }}>
        <div className="more-filter-field">
          <label>{t("contractCaseCreditLimitRequested")}</label>
          <input type="number" step="0.01" className="cost-of-debt-input" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} style={{ width: 140 }} />
        </div>
        <label className="checkbox-inline" style={{ alignSelf: "flex-end", marginBottom: 8 }} onClick={() => setNoteExempt((v) => !v)}>
          <input type="checkbox" checked={noteExempt} readOnly />
          {t("contractCaseNoteExempt")}
        </label>
      </div>

      <div className="user-form-section">
        <div className="user-form-section-title">{t("contractCaseIdentityData")}</div>
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
        <div className="user-form-section-title">{t("contractCaseDocuments")}</div>
        <div className="more-filters-row">
          <FileField label={t("contractCaseDocCR")} required value={docs.commercial_registration} onChange={(v) => setDocs((d) => ({ ...d, commercial_registration: v }))} />
          <FileField label={t("contractCaseDocTax")} required value={docs.tax_certificate} onChange={(v) => setDocs((d) => ({ ...d, tax_certificate: v }))} />
          <FileField label={t("contractCaseDocAddress")} required value={docs.national_address} onChange={(v) => setDocs((d) => ({ ...d, national_address: v }))} />
        </div>
        <div className="more-filters-row" style={{ marginTop: 8 }}>
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

function CaseDetail({ caseId, onClose, onChanged, session }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [noteExpiryDate, setNoteExpiryDate] = useState("");
  const [signedContract, setSignedContract] = useState(null);
  const [signedNote, setSignedNote] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.getContractCase(caseId).then(setC).catch((e) => setError(e.message));
  };
  useEffect(load, [caseId]);

  const canDoStep = (step) => !step.done && (session.role === "admin" || step.assigned_username === session.username);

  const handleCompleteStep = async (stepId) => {
    setBusy(true);
    try {
      await api.completeApprovalStep(caseId, stepId, "");
      load();
      onChanged?.();
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

  const handleMarkSent = async () => {
    setBusy(true);
    try {
      await api.markContractCaseSent(caseId, {
        contract_number: contractNumber || null, contract_date: contractDate || null, note_expiry_date: noteExpiryDate || null,
      });
      load();
      onChanged?.();
      showToast(t("contractCaseMarkedSent"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await api.archiveSignedDocuments(caseId, { signed_contract: signedContract, signed_note: signedNote });
      load();
      onChanged?.();
      showToast(t("contractCaseArchived"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="error-state">{error}</div>;
  if (!c) return <div className="loading-state">{t("loadingDots")}</div>;

  const byTrack = { note: [], contract: [], credit_limit: [], final: [] };
  (c.steps || []).forEach((s) => byTrack[s.track]?.push(s));

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 className="insights-chart-title">{c.customer_name}</h3>
          <span className={`fu-tag ${STATUS_TONE[c.status]}`}>{t(`contractCaseStatus_${c.status}`)}</span>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="more-filters-row" style={{ marginTop: 10 }}>
        <span className="settings-meta">{t("contractCaseCreditLimitRequested")}: <RiyalAmount amount={c.credit_limit_requested} /></span>
        {c.credit_limit_approved != null && <span className="settings-meta">{t("contractCaseCreditLimitApproved")}: <RiyalAmount amount={c.credit_limit_approved} /></span>}
        <span className="settings-meta">{t("contractCaseNoteExempt")}: {c.note_exempt ? t("yes") : t("no")}</span>
      </div>

      {["note", "contract", "credit_limit", "final"].map((track) => (
        byTrack[track].length > 0 && (
          <div key={track} className="user-form-section">
            <div className="user-form-section-title">{t(`approvalTrack_${track}`)}</div>
            {byTrack[track].map((s) => (
              <div key={s.id} className="more-filters-row" style={{ alignItems: "center", padding: "4px 0" }}>
                <span style={{ flex: 1 }}>{s.name}{s.assigned_username ? ` (${s.assigned_username})` : ""}</span>
                {s.done ? (
                  <span className="fu-tag ok"><Check size={11} style={{ verticalAlign: -1 }} /> {s.done_by} - {fmtDateTime(s.done_at)}</span>
                ) : canDoStep(s) ? (
                  <button className="btn-secondary sm" disabled={busy} onClick={() => handleCompleteStep(s.id)}>{t("contractCaseMarkDone")}</button>
                ) : (
                  <span className="fu-tag faint">{t("contractCasePending")}</span>
                )}
              </div>
            ))}
          </div>
        )
      ))}

      <div className="user-form-section">
        <div className="user-form-section-title">{t("contractCaseDocuments")}</div>
        <p className="settings-meta">
          {Object.entries(c.documents).filter(([, v]) => v.has_file).map(([k, v]) => v.file_name).join(" · ") || "—"}
        </p>
      </div>

      {c.status === "ready_to_send" && session.role === "admin" && (
        <div className="user-form-section">
          <div className="user-form-section-title">{t("contractCaseMarkSentTitle")}</div>
          <div className="more-filters-row">
            <div className="more-filter-field"><label>{t("contractCaseContractNumber")}</label><input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} /></div>
            <div className="more-filter-field"><label>{t("contractCaseContractDate")}</label><input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} /></div>
            {!c.note_exempt && <div className="more-filter-field"><label>{t("contractCaseNoteExpiryDate")}</label><input type="date" value={noteExpiryDate} onChange={(e) => setNoteExpiryDate(e.target.value)} /></div>}
          </div>
          <button className="btn-primary sm" style={{ marginTop: 8 }} disabled={busy} onClick={handleMarkSent}>
            <Send size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseMarkSent")}
          </button>
        </div>
      )}

      {(c.status === "sent" || c.status === "archived") && (
        <div className="user-form-section">
          <div className="user-form-section-title">{t("contractCaseArchiveTitle")}</div>
          <div className="more-filters-row">
            <FileField label={t("contractCaseSignedContract")} value={signedContract} onChange={setSignedContract} />
            {!c.note_exempt && <FileField label={t("contractCaseSignedNote")} value={signedNote} onChange={setSignedNote} />}
          </div>
          {c.status !== "archived" && (
            <button className="btn-primary sm" style={{ marginTop: 8 }} disabled={busy} onClick={handleArchive}>
              <Archive size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("contractCaseArchiveSave")}
            </button>
          )}
          {c.status === "archived" && <p className="settings-meta">{t("contractCaseFullyArchived")}</p>}
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
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "create"
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  const load = () => {
    api.listContractCases({ status: statusFilter, search }).then(setCases).catch((e) => setError(e.message));
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, search]);

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
            <CreateCaseForm onCreated={() => { setMode("list"); load(); }} onCancel={() => setMode("list")} />
          </div>
        )}

        {mode === "list" && (
          <>
            <div className="more-filters-row" style={{ marginTop: 14, marginBottom: 14 }}>
              <div className="more-filter-field">
                <div className="input-icon compact"><Search size={13} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} /></div>
              </div>
              <div className="more-filter-field">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{t("allStatus")}</option>
                  {["in_progress", "ready_to_send", "sent", "archived", "rejected"].map((s) => <option key={s} value={s}>{t(`contractCaseStatus_${s}`)}</option>)}
                </select>
              </div>
            </div>

            {error && <div className="error-state">{error}</div>}
            {!error && !cases && <div className="loading-state">{t("loadingDots")}</div>}
            {cases && cases.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

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
              <CaseDetail caseId={selectedCaseId} session={session} onClose={() => setSelectedCaseId(null)} onChanged={load} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
