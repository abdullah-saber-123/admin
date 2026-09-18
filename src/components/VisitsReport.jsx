import { useEffect, useState, useCallback, Fragment } from "react";
import { MapPin, Check, X as XIcon, ClipboardList, Navigation, ExternalLink } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

const STATUS_TONE = { pending: "warn", assigned: "teal", completed: "ok", rejected: "faint" };

function AssignModal({ visit, staffList, onClose, onDone, t, showToast }) {
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignee) return;
    setSaving(true);
    try {
      await api.assignVisitRequest(visit.id, assignee);
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
        <h3>{t("assignVisitTitle")}</h3>
        <p className="prompt-message">{visit.customer_name}</p>
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

function RejectModal({ visit, onClose, onDone, t, showToast }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.rejectVisitRequest(visit.id, note.trim() || null);
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
        <h3>{t("rejectVisitTitle")}</h3>
        <p className="prompt-message">{visit.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("rejectionNoteLabel")}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary danger-btn" disabled={saving}>{saving ? t("saving") : t("reject")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteVisitModal({ visit, onClose, onDone, t, showToast }) {
  const [report, setReport] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(t("locationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setLocationError(t("locationDenied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!report.trim()) return;
    setSaving(true);
    try {
      await api.completeVisitRequest(visit.id, {
        latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null, report: report.trim(),
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
        <h3><Navigation size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("completeVisitTitle")}</h3>
        <p className="prompt-message">{visit.customer_name}</p>
        <form onSubmit={handleSubmit}>
          <label>{t("visitCoordinatesLabel")}</label>
          {locating && <p className="prompt-message">{t("locatingGps")}</p>}
          {locationError && <p className="prompt-message" style={{ color: "var(--danger)" }}>{locationError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" step="0.000001" placeholder={t("latitudeLabel")} value={lat} onChange={(e) => setLat(e.target.value)} />
            <input type="number" step="0.000001" placeholder={t("longitudeLabel")} value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <label style={{ marginTop: 10, display: "block" }}>{t("visitReportLabel")}</label>
          <textarea rows={4} value={report} onChange={(e) => setReport(e.target.value)} placeholder={t("visitReportPlaceholder")} />
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={!report.trim() || saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VisitsReport({ onSelectCustomer, role, username }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.visitRequests({ status: statusFilter, mine: mineOnly }).then(setRows).catch((e) => setError(e.message));
  }, [statusFilter, mineOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (role === "admin") api.staffList().then(setStaffList).catch(() => {}); }, [role]);

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><MapPin size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("visitsTitle")}</h2>
        <p className="panel-sub">{t("visitsHint")}</p>

        <div className="quick-toggle-row" style={{ marginTop: 14, marginBottom: 14 }}>
          <button className={`quick-toggle-chip ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>{t("allStatus")}</button>
          {["pending", "assigned", "completed", "rejected"].map((s) => (
            <button key={s} className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {t(`visitStatus_${s}`)}
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
                  <th>{t("visitReasonLabel")}</th>
                  <th>{t("status")}</th>
                  <th>{t("requestedByLabel")}</th>
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
                      </td>
                      <td data-label={t("balanceDue")}>{r.current_balance !== null ? <RiyalAmount amount={r.current_balance} /> : "—"}</td>
                      <td data-label={t("visitReasonLabel")}>{r.reason}</td>
                      <td data-label={t("status")}>
                        <span className={`fu-tag sm ${STATUS_TONE[r.status]}`}>{t(`visitStatus_${r.status}`)}</span>
                      </td>
                      <td data-label={t("requestedByLabel")}>
                        {r.requested_by}
                        <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{fmtDateTime(r.requested_at)}</div>
                      </td>
                      <td data-label={t("assignTo")}>{r.assigned_to || "—"}</td>
                      <td data-label={t("actions")}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {role === "admin" && r.status === "pending" && (
                            <>
                              <button className="icon-btn" title={t("assignVisitTitle")} onClick={() => setAssignModal(r)}><Check size={13} /></button>
                              <button className="icon-btn" title={t("reject")} onClick={() => setRejectModal(r)}><XIcon size={13} /></button>
                            </>
                          )}
                          {r.status === "assigned" && (role === "admin" || r.assigned_to === username) && (
                            <button className="btn-secondary sm" onClick={() => setCompleteModal(r)}>
                              <Navigation size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("completeVisitTitle")}
                            </button>
                          )}
                          {r.status === "completed" && (
                            <button className="icon-btn" title={t("viewDetails")} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                              <ClipboardList size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === r.id && r.status === "completed" && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--card)" }}>
                          <div style={{ padding: 12 }}>
                            <p style={{ margin: "0 0 6px" }}><strong>{t("visitReportLabel")}:</strong> {r.report}</p>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>
                              {t("completedByLabel")}: {r.completed_by} · {fmtDateTime(r.visited_at)}
                              {r.latitude && r.longitude && (
                                <>
                                  {" · "}
                                  <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
                                    {t("viewOnMap")} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
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
        <AssignModal visit={assignModal} staffList={staffList} onClose={() => setAssignModal(null)} onDone={() => { setAssignModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {rejectModal && (
        <RejectModal visit={rejectModal} onClose={() => setRejectModal(null)} onDone={() => { setRejectModal(null); load(); }} t={t} showToast={showToast} />
      )}
      {completeModal && (
        <CompleteVisitModal visit={completeModal} onClose={() => setCompleteModal(null)} onDone={() => { setCompleteModal(null); load(); }} t={t} showToast={showToast} />
      )}
    </div>
  );
}
