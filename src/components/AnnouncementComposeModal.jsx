import { useState } from "react";
import { Megaphone, Image as ImageIcon, X as XIcon } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AnnouncementComposeModal({ contacts, initialSelected = [], initialMessage = "", partnerId = null, onClose, onSent }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [selection, setSelection] = useState(initialSelected);
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null); // { dataUrl, mimetype }

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("announcementAttachmentImageOnly"), "error");
      return;
    }
    const dataUrl = await fileToBase64(file);
    setAttachment({ dataUrl, mimetype: file.type });
  };

  const handleSend = async () => {
    if (selection.length === 0 || !message.trim()) return;
    setSending(true);
    try {
      await api.sendAnnouncement({
        usernames: selection, message: message.trim(), partner_id: partnerId,
        attachment_data: attachment?.dataUrl || null, attachment_mimetype: attachment?.mimetype || null,
      });
      showToast(t("announcementSent"), "success");
      onSent?.();
      onClose?.();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <h3><Megaphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("sendAnnouncement")}</h3>
        <p className="prompt-message">{t("announcementHint")}</p>
        <div className="multiselect-list">
          {(contacts || []).length === 0 && <div className="empty-state" style={{ padding: "10px 0" }}>{t("loadingDots")}</div>}
          {(contacts || []).map((c) => (
            <label key={c.username} className="multiselect-item">
              <input
                type="checkbox"
                checked={selection.includes(c.username)}
                onChange={() => {
                  setSelection((prev) =>
                    prev.includes(c.username) ? prev.filter((u) => u !== c.username) : [...prev, c.username]
                  );
                }}
              />
              {c.full_name || c.username}
            </label>
          ))}
        </div>
        <textarea
          className="announcement-compose-textarea"
          placeholder={t("announcementMessagePlaceholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />

        {attachment ? (
          <div style={{ position: "relative", marginTop: 10, display: "inline-block" }}>
            <img src={attachment.dataUrl} alt="" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, display: "block" }} />
            <button
              type="button" className="icon-btn" onClick={() => setAttachment(null)}
              style={{ position: "absolute", top: 6, insetInlineEnd: 6, background: "rgba(0,0,0,0.55)", color: "#fff" }}
            >
              <XIcon size={13} />
            </button>
          </div>
        ) : (
          <label className="btn-secondary sm" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content" }}>
            <ImageIcon size={13} /> {t("announcementAddAttachment")}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
        )}

        <div className="prompt-actions">
          <button className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
          <button className="btn-primary" disabled={selection.length === 0 || !message.trim() || sending} onClick={handleSend}>
            <Megaphone size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {sending ? t("sending") : `${t("sendAnnouncement")} (${selection.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
