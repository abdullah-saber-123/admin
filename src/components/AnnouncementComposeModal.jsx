import { useState } from "react";
import { Megaphone } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

export default function AnnouncementComposeModal({ contacts, initialSelected = [], initialMessage = "", partnerId = null, onClose, onSent }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [selection, setSelection] = useState(initialSelected);
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (selection.length === 0 || !message.trim()) return;
    setSending(true);
    try {
      await api.sendAnnouncement({ usernames: selection, message: message.trim(), partner_id: partnerId });
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
