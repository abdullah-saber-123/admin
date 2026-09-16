import { useEffect, useState } from "react";
import { X, Share2, Clock, Trash2, Check } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import useBodyScrollLock from "../hooks/useBodyScrollLock.js";

const DURATION_OPTIONS = [
  { key: "1d", hours: 24 },
  { key: "3d", hours: 72 },
  { key: "1w", hours: 24 * 7 },
  { key: "1m", hours: 24 * 30 },
];

export default function ShareCustomerModal({ partnerId, onClose }) {
  const { t } = useLang();
  const { showToast } = useToast();
  useBodyScrollLock(true);
  const me = getSession()?.username;

  const [staff, setStaff] = useState([]);
  const [shares, setShares] = useState(null);
  const [grantedTo, setGrantedTo] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("3d");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.listTempAccess(partnerId).then(setShares).catch(() => setShares([]));
  };

  useEffect(() => {
    api.staffList().then(setStaff).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!grantedTo) return;
    setSaving(true);
    try {
      const hours = DURATION_OPTIONS.find((d) => d.key === duration)?.hours || 72;
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      await api.grantTempAccess({ partner_id: partnerId, granted_to: grantedTo, reason: reason.trim() || null, expires_at: expiresAt });
      setGrantedTo("");
      setReason("");
      load();
      showToast(t("shareGranted"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await api.revokeTempAccess(id);
      load();
      showToast(t("shareRevoked"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleRespond = async (id, accept) => {
    try {
      await api.respondTempAccess(id, accept);
      load();
      showToast(accept ? t("shareAccepted") : t("shareRejected"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal share-customer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3><Share2 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("shareCustomerTitle")}</h3>
        <p className="panel-sub" style={{ margin: "0 0 16px" }}>{t("shareCustomerHint")}</p>

        <form onSubmit={handleGrant} className="admin-form" style={{ maxWidth: "none" }}>
          <label>{t("shareWithLabel")}</label>
          <select value={grantedTo} onChange={(e) => setGrantedTo(e.target.value)} required>
            <option value="">{t("selectCollector")}</option>
            {staff.map((s) => (
              <option key={s.username} value={s.username}>{s.full_name || s.username}</option>
            ))}
          </select>

          <label>{t("shareDurationLabel")}</label>
          <div className="share-duration-row">
            {DURATION_OPTIONS.map((d) => (
              <button
                type="button"
                key={d.key}
                className={`filter-chip ${duration === d.key ? "active" : ""}`}
                onClick={() => setDuration(d.key)}
              >
                {t(`duration_${d.key}`)}
              </button>
            ))}
          </div>

          <label>{t("shareReasonLabel")}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("shareReasonPlaceholder")}
            style={{
              width: "100%", minHeight: 60, background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 9, color: "var(--text)", padding: 9, fontSize: 13, fontFamily: "inherit",
            }}
          />

          <button className="btn-primary" type="submit" disabled={saving || !grantedTo} style={{ marginTop: 12 }}>
            {saving ? t("saving") : t("shareGrantButton")}
          </button>
        </form>

        {shares && shares.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="user-form-section-title" style={{ marginBottom: 8 }}>{t("activeSharesTitle")}</div>
            {shares.map((s) => (
              <div key={s.id} className="active-share-row">
                <div>
                  <div className="active-share-row-main">
                    {s.granted_by_name} → {s.granted_to_name}
                    <span className={`share-status-badge ${s.status}`}>{t(`shareStatus_${s.status}`)}</span>
                  </div>
                  <div className="active-share-row-sub">
                    <Clock size={11} style={{ verticalAlign: -1 }} /> {t("expiresLabel")} {fmtDateTime(s.expires_at)}
                    {s.reason && <> · {s.reason}</>}
                  </div>
                </div>
                {s.status === "pending" && s.granted_to === me && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" style={{ color: "var(--ok)" }} title={t("accept")} onClick={() => handleRespond(s.id, true)}>
                      <Check size={13} />
                    </button>
                    <button className="icon-btn danger" title={t("decline")} onClick={() => handleRespond(s.id, false)}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                {s.status !== "pending" && s.granted_by === me && (
                  <button className="icon-btn danger" title={t("revoke")} onClick={() => handleRevoke(s.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
