import { useEffect, useState, useRef } from "react";
import {
  Lock, User as UserIcon, LogOut, Phone, MessageCircle, Wallet, AlertTriangle,
  CalendarClock, Languages, ShieldCheck, TrendingUp, Upload, Send, Paperclip,
} from "lucide-react";
import { portalApi, getPortalSession, setPortalSession, clearPortalSession } from "./portalApi.js";
import { useLang } from "./i18n.jsx";
import { useToast } from "./toast.jsx";
import RiyalAmount from "./components/RiyalAmount.jsx";
import Avatar from "./components/Avatar.jsx";
import { fmtDate, fmtDateTime } from "./dateUtils.js";
import swagLogo from "./assets/swag-mark.png";

function waLink(phone) {
  if (!phone) return null;
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}`;
}

function PortalLogin({ onLoggedIn }) {
  const { t, lang, setLanguage } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.login(username, password);
      setPortalSession(res.token, res.customer_name);
      onLoggedIn(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="lang-toggle portal-lang-toggle" onClick={() => setLanguage(lang === "en" ? "ar" : "en")}>
        <Languages size={13} />
        {lang === "en" ? "AR" : "EN"}
      </button>
      <div className="login-card">
        <div className="login-logo login-logo-img">
          <img src={swagLogo} alt="SWAG" />
        </div>
        <h1>{t("portalTitle")}</h1>
        <p className="login-sub">{t("portalLoginHint")}</p>
        <form onSubmit={submit}>
          <div className="input-icon">
            <UserIcon size={16} />
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("portalUsername")} autoFocus />
          </div>
          <div className="input-icon">
            <Lock size={16} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} />
          </div>
          {error && <div className="error-state">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: 10 }}>
            {loading ? t("loadingDots") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}

function ForceChangePassword({ onDone }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await portalApi.changePassword(current, next);
      showToast(t("passwordUpdated"), "success");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo login-logo-img">
          <img src={swagLogo} alt="SWAG" />
        </div>
        <h1>{t("changePasswordTitle")}</h1>
        <p className="login-sub">{t("forceChangePasswordHint")}</p>
        <form onSubmit={submit}>
          <div className="input-icon">
            <Lock size={16} />
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={t("currentPassword")} autoFocus />
          </div>
          <div className="input-icon">
            <Lock size={16} />
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={t("newPassword")} />
          </div>
          <div className="input-icon">
            <Lock size={16} />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("confirmPassword")} />
          </div>
          {error && <div className="error-state">{error}</div>}
          <button className="btn-primary" type="submit" disabled={saving} style={{ width: "100%", marginTop: 10 }}>
            {saving ? t("saving") : t("save")}
          </button>
        </form>
      </div>
    </div>
  );
}

function PaymentProofSection() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [proofs, setProofs] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    portalApi.myPaymentProofs().then(setProofs).catch(() => {});
  };
  useEffect(load, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      showToast(t("fileTooLarge"), "error");
      e.target.value = "";
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setFile(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast(t("selectFileFirst"), "error");
      return;
    }
    setUploading(true);
    try {
      const [prefix, base64] = file.split(",");
      const mime = prefix.match(/data:(.*);base64/)?.[1] || "application/octet-stream";
      await portalApi.uploadPaymentProof({
        amount: amount ? Number(amount) : null, note: note || null,
        file_name: fileName, file_type: mime, file_data: base64,
      });
      setAmount(""); setNote(""); setFile(null); setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
      showToast(t("proofUploaded"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const statusTone = { pending: "warn", confirmed: "ok", rejected: "danger" };

  return (
    <div className="portal-section">
      <h3><Upload size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("uploadPaymentProof")}</h3>
      <form onSubmit={submit} className="admin-form" style={{ maxWidth: "none" }}>
        <label>{t("amountPaid")}</label>
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <label>{t("noteOptional")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
        <label>{t("receiptFile")}</label>
        <button type="button" className="btn-secondary sm" onClick={() => fileInputRef.current?.click()} style={{ alignSelf: "flex-start" }}>
          <Paperclip size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
          {fileName || t("chooseFile")}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: "none" }} />
        <button className="btn-primary sm" type="submit" disabled={uploading} style={{ marginTop: 10, alignSelf: "flex-start" }}>
          {uploading ? t("saving") : t("submitProof")}
        </button>
      </form>

      {proofs && proofs.length > 0 && (
        <div className="portal-proof-list">
          {proofs.map((p) => (
            <div key={p.id} className="portal-proof-item">
              <div>
                <div className="portal-proof-amount">{p.amount ? <RiyalAmount amount={p.amount} /> : p.file_name}</div>
                <div className="portal-proof-date">{fmtDateTime(p.created_at)}</div>
                {p.review_note && <div className="portal-proof-review-note">{p.review_note}</div>}
              </div>
              <span className={`fu-tag ${statusTone[p.status] || "faint"}`}>{t(`proofStatus_${p.status}`)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatSection() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const windowRef = useRef(null);

  const load = () => {
    portalApi.getChat().then(setMessages).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Scroll ONLY the chat box itself to its latest message - never the whole
    // page (scrollIntoView on a plain marker element can drag the entire page
    // down to it, which looked like the dashboard "auto-scrolling").
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await portalApi.sendChat(text.trim());
      setText("");
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="portal-section">
      <h3><MessageCircle size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("chatWithCollector")}</h3>
      <div className="chat-window" ref={windowRef}>
        {!messages && <div className="loading-state">{t("loadingDots")}</div>}
        {messages && messages.length === 0 && <div className="empty-state">{t("noMessagesYet")}</div>}
        {messages && messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender_type === "customer" ? "mine" : "theirs"}`}>
            <div className="chat-bubble-text">{m.message}</div>
            <div className="chat-bubble-time">{fmtDateTime(m.created_at)}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="chat-input-row">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("typeMessage")} />
        <button type="submit" className="btn-primary sm" disabled={sending || !text.trim()}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

function PortalDashboard({ onLogout }) {
  const { t, lang, setLanguage } = useLang();
  const { showToast } = useToast();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    portalApi.me().then(setMe).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="error-state">{error}</div>
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onLogout}>{t("logout")}</button>
        </div>
      </div>
    );
  }

  if (!me) {
    return <div className="portal-loading"><div className="loading-state">{t("loadingDots")}</div></div>;
  }

  // Enforced on EVERY load (not just right after login) - so a customer can't
  // bypass the forced password change by simply closing the tab mid-flow and
  // coming back later with their session token still valid.
  if (me.must_change_password) {
    return <ForceChangePassword onDone={() => setMe((prev) => ({ ...prev, must_change_password: false }))} />;
  }

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <div className="portal-topbar-brand">
          <img src={swagLogo} alt="SWAG" className="sidebar-logo-img" />
          <span>{t("portalTitle")}</span>
        </div>
        <div className="portal-topbar-actions">
          <button className="lang-toggle" onClick={() => setLanguage(lang === "en" ? "ar" : "en")}>
            <Languages size={13} />
            {lang === "en" ? "AR" : "EN"}
          </button>
          <button className="icon-btn" title={t("logout")} onClick={onLogout}>
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="portal-content">
        <div className="portal-welcome">
          <h1>{t("portalWelcome")}, {me.name}</h1>
          <p>{me.city || ""}</p>
        </div>

        <div className="portal-kpi-grid">
          <div className="portal-kpi-card primary">
            <Wallet size={20} />
            <div className="k">{t("balanceDue")}</div>
            <div className="v"><RiyalAmount amount={me.current_due} /></div>
          </div>
          <div className="portal-kpi-card danger">
            <AlertTriangle size={20} />
            <div className="k">{t("overdueAmount")}</div>
            <div className="v"><RiyalAmount amount={me.overdue_amount} /></div>
          </div>
          <div className="portal-kpi-card">
            <TrendingUp size={20} />
            <div className="k">{t("totalPaid")}</div>
            <div className="v"><RiyalAmount amount={me.total_paid} /></div>
          </div>
        </div>

        {(me.next_due_date || me.upcoming_installment_date) && (
          <div className="portal-section">
            <h3><CalendarClock size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("upcomingPayments")}</h3>
            <div className="portal-due-row">
              {me.next_due_date && (
                <div className="portal-due-item overdue">
                  <div className="k">{t("oldestUnpaidDue")}</div>
                  <div className="v">{fmtDate(me.next_due_date)}</div>
                  <RiyalAmount amount={me.next_due_amount} />
                </div>
              )}
              {me.upcoming_installment_date && (
                <div className="portal-due-item upcoming">
                  <div className="k">{t("upcomingInstallment")}</div>
                  <div className="v">{fmtDate(me.upcoming_installment_date)}</div>
                  <RiyalAmount amount={me.upcoming_installment_amount} />
                </div>
              )}
            </div>
          </div>
        )}

        {me.collector_name && (
          <div className="portal-section">
            <h3><UserIcon size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("yourCollector")}</h3>
            <div className="portal-collector-card">
              <Avatar name={me.collector_name} />
              <div className="portal-collector-info">
                <div className="portal-collector-name">{me.collector_name}</div>
                {me.collector_phone && <bdi dir="ltr" className="portal-collector-phone">{me.collector_phone}</bdi>}
              </div>
              {me.collector_phone && (
                <div className="row-actions">
                  <a href={`tel:${me.collector_phone}`} className="icon-btn" title={t("call")}><Phone size={15} /></a>
                  <a href={waLink(me.collector_phone)} target="_blank" rel="noreferrer" className="icon-btn wa" title={t("whatsappChat")}>
                    <MessageCircle size={15} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <PaymentProofSection />
        <ChatSection />

        <button className="btn-secondary" onClick={() => setShowChangePw(true)}>
          <ShieldCheck size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
          {t("changePasswordTitle")}
        </button>
      </div>

      {showChangePw && (
        <div className="overlay modal-overlay" onClick={() => setShowChangePw(false)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <ChangePasswordForm onDone={() => { setShowChangePw(false); showToast(t("passwordUpdated"), "success"); }} onCancel={() => setShowChangePw(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordForm({ onDone, onCancel }) {
  const { t } = useLang();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await portalApi.changePassword(current, next);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h3>{t("changePasswordTitle")}</h3>
      <form onSubmit={submit}>
        <label>{t("currentPassword")}</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        <label>{t("newPassword")}</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        <label>{t("confirmPassword")}</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <div className="error-state">{error}</div>}
        <div className="prompt-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("saving") : t("save")}</button>
        </div>
      </form>
    </>
  );
}

function PortalRoot() {
  const [session, setSessionState] = useState(getPortalSession());

  if (!session) {
    return <PortalLogin onLoggedIn={() => setSessionState(getPortalSession())} />;
  }

  return (
    <PortalDashboard
      onLogout={() => {
        clearPortalSession();
        setSessionState(null);
      }}
    />
  );
}

export default function CustomerPortalApp() {
  return <PortalRoot />;
}
