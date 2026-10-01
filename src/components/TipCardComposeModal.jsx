import { useState } from "react";
import { Lightbulb, Image as ImageIcon, X as XIcon } from "lucide-react";
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

export default function TipCardComposeModal({ contacts, editingCard = null, onClose, onSaved }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [selection, setSelection] = useState(editingCard?.target_usernames || []);
  const [title, setTitle] = useState(editingCard?.title || "");
  const [body, setBody] = useState(editingCard?.body || "");
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(editingCard?.image_url ? { dataUrl: editingCard.image_url, mimetype: editingCard.image_url.split(";")[0].replace("data:", "") } : null);

  const allSelected = (contacts || []).length > 0 && selection.length === contacts.length;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("announcementAttachmentImageOnly"), "error");
      return;
    }
    const dataUrl = await fileToBase64(file);
    setImage({ dataUrl, mimetype: file.type });
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), body: body.trim(), usernames: selection,
        image_data: image?.dataUrl || null, image_mimetype: image?.mimetype || null,
      };
      if (editingCard) {
        await api.updateTipCard(editingCard.id, payload);
      } else {
        await api.createTipCard(payload);
      }
      showToast(t("tipCardSaved"), "success");
      onSaved?.();
      onClose?.();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <h3><Lightbulb size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{editingCard ? t("editTipCard") : t("newTipCard")}</h3>
        <p className="prompt-message">{t("tipCardHint")}</p>

        <input
          placeholder={t("tipCardTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <textarea
          className="announcement-compose-textarea"
          placeholder={t("tipCardBodyPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
        />

        {image ? (
          <div style={{ position: "relative", marginTop: 10, display: "inline-block" }}>
            <img src={image.dataUrl} alt="" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, display: "block" }} />
            <button
              type="button" className="icon-btn" onClick={() => setImage(null)}
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

        <div style={{ marginTop: 14 }}>
          <label className="checkbox-inline" style={{ marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelection(allSelected ? [] : (contacts || []).map((c) => c.username))}
            />
            {t("tipCardTargetAll")}
          </label>
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
          <p className="settings-meta" style={{ marginTop: 6 }}>{t("tipCardTargetHint")}</p>
        </div>

        <div className="prompt-actions">
          <button className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
          <button className="btn-primary" disabled={!title.trim() || !body.trim() || saving} onClick={handleSave}>
            <Lightbulb size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {saving ? t("saving") : t("saveTipCard")}
          </button>
        </div>
      </div>
    </div>
  );
}
