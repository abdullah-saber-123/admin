import { useEffect, useState } from "react";
import { X, Camera, Phone, MessageCircle, PhoneCall, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import Avatar from "./Avatar.jsx";
import useBodyScrollLock from "../hooks/useBodyScrollLock.js";
import usePushNotifications from "../hooks/usePushNotifications.js";

function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

/**
 * mode:
 *   "self"      - the logged-in user editing their own name/phone/email/photo/password
 *   "user"      - viewing another teammate's card by user id (from the Users list)
 *   "collector" - viewing a collector's card by the raw Odoo salesperson name
 *                 shown in the Customer table's "Collector" column
 */
export default function ProfileModal({ mode, userId, collectorName, onClose, callOverlayRef, onProfileUpdated }) {
  const { t } = useLang();
  const { showToast } = useToast();
  useBodyScrollLock(true);
  const push = usePushNotifications();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    const loader = mode === "self" ? api.myProfile()
      : mode === "user" ? api.userProfile(userId)
      : api.collectorProfileByName(collectorName);
    loader
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId, collectorName]);

  // Phone camera photos are often 3-8MB, which either blows past the API's
  // own size cap or gets silently rejected by a reverse proxy's body-size
  // limit before it even reaches the backend - either way it looks like
  // "upload does nothing". Shrinking to a small square avatar client-side
  // (well under 100KB typically) avoids both problems entirely.
  const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // Cover-fit: scale so the shorter side fills the square, then
        // center-crop the overflow - matches how the round avatar displays it.
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file again re-fire onChange
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("photoTooLarge"), "error");
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setAvatarPreview(dataUrl);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { full_name: fullName, phone, email };
      if (avatarPreview) payload.avatar_data = avatarPreview;
      const updated = await api.updateMyProfile(payload);
      setProfile(updated);
      setAvatarPreview(null);
      onProfileUpdated?.(updated);
      showToast(t("profileSaved"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      showToast(t("passwordsDontMatch"), "error");
      return;
    }
    setChangingPassword(true);
    try {
      await api.changeMyPassword(currentPassword, newPassword);
      showToast(t("passwordUpdated"), "success");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleInternetCall = () => {
    if (!profile?.username) return;
    callOverlayRef?.current?.startCall(profile.username, profile.full_name || profile.username);
    onClose();
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>

        {loading && <div className="loading-state">{t("loadingDots")}</div>}
        {!loading && notFound && <div className="empty-state">{t("noLinkedAccount")}</div>}

        {!loading && !notFound && profile && mode === "self" && (
          <>
            <div className="profile-modal-avatar-row">
              <label className="profile-avatar-upload">
                {avatarPreview || profile.avatar_url ? (
                  <img src={avatarPreview || profile.avatar_url} alt="" />
                ) : (
                  <Avatar name={fullName || profile.username} size="lg" />
                )}
                <span className="profile-avatar-edit-badge"><Camera size={13} /></span>
                <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="profile-modal-form">
              <label>{t("fullName")}</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullName")} />
              <label>{t("phone")}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} />
              <label>{t("email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email")} />
              <button className="btn-primary full-width" onClick={handleSave} disabled={saving} style={{ marginTop: 6 }}>
                {saving ? t("saving") : t("saveChanges")}
              </button>

              <button className="profile-password-toggle" onClick={() => setShowPasswordForm((v) => !v)}>
                <ShieldCheck size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {t("changePassword")}
              </button>
              {showPasswordForm && (
                <div className="profile-password-form">
                  <input type="password" placeholder={t("currentPassword")} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  <input type="password" placeholder={t("newPassword")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <input type="password" placeholder={t("confirmPassword")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  <button className="btn-secondary sm full-width" onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword ? t("saving") : t("updatePassword")}
                  </button>
                </div>
              )}

              {push.supported && (
                <div className="profile-push-row">
                  <div>
                    <div className="profile-push-row-title">{t("pushNotifications")}</div>
                    <div className="profile-push-row-sub">{push.subscribed ? t("pushEnabled") : t("pushDisabled")}</div>
                  </div>
                  <button
                    className={`btn-secondary sm ${push.subscribed ? "danger" : ""}`}
                    disabled={push.busy}
                    onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())}
                  >
                    {push.subscribed ? t("disablePushNotifications") : t("enablePushNotifications")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && !notFound && profile && mode !== "self" && (
          <div className="profile-modal-view">
            <div className="profile-modal-avatar-row">
              {profile.avatar_url ? (
                <img className="profile-view-avatar-img" src={profile.avatar_url} alt="" />
              ) : (
                <Avatar name={profile.full_name || profile.username} size="lg" />
              )}
            </div>
            <h3>{profile.full_name || profile.username}</h3>
            <p className="profile-modal-role">{profile.role}</p>
            {profile.phone && <p className="profile-modal-contact-line">{profile.phone}</p>}
            {profile.email && <p className="profile-modal-contact-line">{profile.email}</p>}

            <div className="profile-modal-actions">
              {profile.phone && (
                <a className="btn-secondary sm" href={`tel:${profile.phone}`}>
                  <Phone size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {t("call")}
                </a>
              )}
              {profile.phone && (
                <a className="btn-secondary sm" href={waLink(profile.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  WhatsApp
                </a>
              )}
              {callOverlayRef && (
                <button className="btn-primary sm" onClick={handleInternetCall}>
                  <PhoneCall size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {t("internetCall")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
