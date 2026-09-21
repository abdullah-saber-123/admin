import { useEffect, useState } from "react";
import { MessageCircle, Send, ListOrdered } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

export default function WhatsAppSettingsPanel() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.whatsappSettings().then(setForm).catch((e) => setError(e.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateWhatsappSettings({ ...form, access_token: accessToken || undefined });
      setAccessToken("");
      showToast(t("saved"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      await api.testWhatsappSettings(testPhone);
      showToast(t("whatsappTestSent"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setTesting(false);
    }
  };

  if (error) return <div className="content-stack"><div className="panel"><div className="error-state">{error}</div></div></div>;
  if (!form) return <div className="content-stack"><div className="panel"><div className="loading-state">{t("loadingDots")}</div></div></div>;

  return (
    <div className="content-stack" style={{ maxWidth: 720 }}>
      <div className="panel">
        <h2><MessageCircle size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("whatsappIntegrationTitle")}</h2>
        <p className="panel-sub">{t("whatsappIntegrationHint")}</p>

        <div className="panel" style={{ marginTop: 14, marginBottom: 14, background: "var(--card)" }}>
          <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>
            <ListOrdered size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("whatsappHowToTitle")}
          </h3>
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 12.5, lineHeight: 2, color: "var(--text-dim)" }}>
            <li>{t("whatsappHowToStep1")}</li>
            <li>{t("whatsappHowToStep2")}</li>
            <li>{t("whatsappHowToStep3")}</li>
            <li>{t("whatsappHowToStep4")}</li>
            <li>{t("whatsappHowToStep5")}</li>
          </ol>
        </div>

        <form onSubmit={handleSave} className="admin-form" style={{ maxWidth: "none" }}>
          <label className="multiselect-item" style={{ padding: "6px 0 14px" }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {t("whatsappEnable")}
          </label>

          <label>{t("whatsappPhoneNumberId")}</label>
          <input
            value={form.phone_number_id || ""} onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))}
            placeholder="123456789012345"
          />

          <label style={{ marginTop: 10 }}>{t("whatsappAccessToken")}</label>
          <input
            type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            placeholder={form.has_access_token ? t("whatsappTokenSavedPlaceholder") : "EAAxxxxxxxxxxxxx..."}
          />
          <p className="settings-meta" style={{ marginTop: 4 }}>{t("whatsappTokenHelp")}</p>

          <label style={{ marginTop: 10 }}>{t("whatsappTemplateName")}</label>
          <input
            value={form.template_name || ""} onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))}
            placeholder="payment_reminder"
          />
          <p className="settings-meta" style={{ marginTop: 4 }}>{t("whatsappTemplateHelp")}</p>

          <label style={{ marginTop: 10 }}>{t("whatsappTemplateLanguage")}</label>
          <input
            value={form.template_language || "ar"} onChange={(e) => setForm((f) => ({ ...f, template_language: e.target.value }))}
            style={{ maxWidth: 100 }}
          />

          <div className="user-form-section" style={{ marginTop: 14 }}>
            <div className="user-form-section-title">{t("whatsappScheduleTitle")}</div>
            <label>{t("whatsappRemindDaysBefore")}</label>
            <input
              type="number" min="0" value={form.remind_days_before_due}
              onChange={(e) => setForm((f) => ({ ...f, remind_days_before_due: parseInt(e.target.value) || 0 }))}
              style={{ maxWidth: 100 }}
            />
            <label style={{ marginTop: 10 }}>{t("whatsappRemindRepeatOverdue")}</label>
            <input
              type="number" min="1" value={form.remind_repeat_days_overdue}
              onChange={(e) => setForm((f) => ({ ...f, remind_repeat_days_overdue: parseInt(e.target.value) || 1 }))}
              style={{ maxWidth: 100 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <h3 className="insights-chart-title" style={{ marginBottom: 4 }}>{t("whatsappTestTitle")}</h3>
          <p className="panel-sub" style={{ marginBottom: 10 }}>{t("whatsappTestHint")}</p>
          <div className="more-filters-row">
            <div className="more-filter-field">
              <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+9665xxxxxxxx" />
            </div>
            <div className="more-filter-field" style={{ alignSelf: "flex-end" }}>
              <button className="btn-secondary sm" type="button" onClick={handleTest} disabled={testing || !testPhone}>
                <Send size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {testing ? t("sending") : t("whatsappSendTest")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
