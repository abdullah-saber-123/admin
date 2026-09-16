import { useEffect, useState } from "react";
import { Receipt, Check, X as XIcon, FileText, Image as ImageIcon } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function PaymentProofsReport({ onSelectCustomer }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [proofs, setProofs] = useState(null);
  const [error, setError] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerType, setViewerType] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState(null);

  const load = () => {
    setError(null);
    api.paymentProofs(statusFilter).then(setProofs).catch((e) => setError(e.message));
  };
  useEffect(load, [statusFilter]);

  const viewFile = async (id) => {
    try {
      const { url, type } = await api.paymentProofFile(id);
      setViewerUrl(url);
      setViewerType(type);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const startReview = (id, action) => {
    setReviewingId(id);
    setReviewAction(action);
    setReviewNote("");
  };

  const submitReview = async () => {
    try {
      await api.reviewPaymentProof(reviewingId, { status: reviewAction, review_note: reviewNote || null });
      setReviewingId(null);
      load();
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const statusTone = { pending: "warn", confirmed: "ok", rejected: "danger" };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Receipt size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("paymentProofsTitle")}</h2>
        <p className="panel-sub">{t("paymentProofsHint")}</p>

        <div className="quick-toggle-row">
          {["pending", "confirmed", "rejected", ""].map((s) => (
            <button key={s || "all"} className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {s ? t(`proofStatus_${s}`) : t("allStatus")}
            </button>
          ))}
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !proofs && <div className="loading-state">{t("loadingDots")}</div>}
        {proofs && proofs.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {proofs && proofs.length > 0 && (
          <div className="status-config-list">
            {proofs.map((p) => (
              <div className="status-config-row" key={p.id} style={{ flexWrap: "wrap" }}>
                <span className="cust-name clickable-row" onClick={() => onSelectCustomer?.(p.partner_id)}>{p.customer_name}</span>
                <span>{p.amount ? <RiyalAmount amount={p.amount} /> : "—"}</span>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{fmtDateTime(p.created_at)}</span>
                {p.file_name && (
                  <button className="btn-secondary sm" onClick={() => viewFile(p.id)}>
                    {(p.file_type || "").includes("pdf") ? <FileText size={13} /> : <ImageIcon size={13} />}
                    {" "}{t("viewFile")}
                  </button>
                )}
                <span className={`fu-tag ${statusTone[p.status] || "faint"}`}>{t(`proofStatus_${p.status}`)}</span>
                {p.status === "pending" && (
                  <div className="row-actions">
                    <button className="icon-btn" title={t("confirmProof")} onClick={() => startReview(p.id, "confirmed")}>
                      <Check size={14} />
                    </button>
                    <button className="icon-btn danger" title={t("rejectProof")} onClick={() => startReview(p.id, "rejected")}>
                      <XIcon size={14} />
                    </button>
                  </div>
                )}
                {p.review_note && <div className="status-rule-badge" style={{ width: "100%" }}>{p.review_note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewerUrl && (
        <div className="overlay modal-overlay" onClick={() => setViewerUrl(null)}>
          <div className="prompt-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            {viewerType?.includes("pdf") ? (
              <iframe src={viewerUrl} title="proof" style={{ width: "100%", height: "70vh", border: "none" }} />
            ) : (
              <img src={viewerUrl} alt="proof" style={{ width: "100%", borderRadius: 10 }} />
            )}
          </div>
        </div>
      )}

      {reviewingId && (
        <div className="overlay modal-overlay" onClick={() => setReviewingId(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{reviewAction === "confirmed" ? t("confirmProof") : t("rejectProof")}</h3>
            <label>{t("noteOptional")}</label>
            <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} autoFocus />
            <div className="prompt-actions">
              <button className="btn-secondary" onClick={() => setReviewingId(null)}>{t("cancel")}</button>
              <button className="btn-primary" onClick={submitReview}>{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
