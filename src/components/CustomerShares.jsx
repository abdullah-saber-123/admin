import { useEffect, useState } from "react";
import { Share2, Check, X, Trash2, Clock, Inbox, Send } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";

function ShareRow({ s, me, onRespond, onRevoke, t, showCustomer = true }) {
  return (
    <div className="active-share-row">
      <div>
        <div className="active-share-row-main">
          {showCustomer && <>{s.customer_name} · </>}
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
          <button className="icon-btn" style={{ color: "var(--ok)" }} title={t("accept")} onClick={() => onRespond(s.id, true)}>
            <Check size={13} />
          </button>
          <button className="icon-btn danger" title={t("decline")} onClick={() => onRespond(s.id, false)}>
            <X size={13} />
          </button>
        </div>
      )}
      {s.status !== "pending" && s.granted_by === me && (
        <button className="icon-btn danger" title={t("revoke")} onClick={() => onRevoke(s.id)}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

export default function CustomerShares() {
  const { t } = useLang();
  const { showToast } = useToast();
  const me = getSession()?.username;
  const role = getSession()?.role;
  const [shares, setShares] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    api.listTempAccess().then(setShares).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const handleRespond = async (id, accept) => {
    try {
      await api.respondTempAccess(id, accept);
      load();
      showToast(accept ? t("shareAccepted") : t("shareRejected"), "success");
    } catch (err) {
      showToast(err.message, "error");
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

  const pending = (shares || []).filter((s) => s.status === "pending" && s.granted_to === me);
  const receivedActive = (shares || []).filter((s) => s.status === "accepted" && s.granted_to === me);
  const sentByMe = (shares || []).filter((s) => s.granted_by === me);
  const allShares = shares || [];

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><Share2 size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customerSharesTitle")}</h2>
        <p className="panel-sub">{t("customerSharesHint")}</p>

        {error && <div className="error-state">{error}</div>}
        {!error && !shares && <div className="loading-state">{t("loadingDots")}</div>}

        {shares && (
          <>
            <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>
              <Inbox size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              {t("pendingForYouTitle")} {pending.length > 0 && <span className="user-form-box-count">{pending.length}</span>}
            </h3>
            {pending.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 20 }}>{t("noPendingShares")}</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {pending.map((s) => (
                  <ShareRow key={s.id} s={s} me={me} onRespond={handleRespond} onRevoke={handleRevoke} t={t} />
                ))}
              </div>
            )}

            <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>{t("sharedWithYouTitle")}</h3>
            {receivedActive.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 20 }}>{t("noActiveShares")}</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {receivedActive.map((s) => (
                  <ShareRow key={s.id} s={s} me={me} onRespond={handleRespond} onRevoke={handleRevoke} t={t} />
                ))}
              </div>
            )}

            <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>
              <Send size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              {t("youveSharedTitle")}
            </h3>
            {sentByMe.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 20 }}>{t("noSentShares")}</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {sentByMe.map((s) => (
                  <ShareRow key={s.id} s={s} me={me} onRespond={handleRespond} onRevoke={handleRevoke} t={t} />
                ))}
              </div>
            )}

            {role === "admin" && (
              <>
                <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>{t("allSharesTitle")}</h3>
                {allShares.length === 0 ? (
                  <div className="empty-state">{t("noSentShares")}</div>
                ) : (
                  <div>
                    {allShares.map((s) => (
                      <ShareRow key={s.id} s={s} me={me} onRespond={handleRespond} onRevoke={handleRevoke} t={t} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
