import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

export default function TeamsSettingsPanel() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.teamsSettings().then(setForm).catch((e) => setError(e.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateTeamsSettings(form);
      showToast(t("saved"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.testTeamsSettings();
      showToast(t("teamsTestSent"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setTesting(false);
    }
  };

  if (error) return <div className="content-stack"><div className="panel"><div className="error-state">{error}</div></div></div>;
  if (!form) return <div className="content-stack"><div className="panel"><div className="loading-state">{t("loadingDots")}</div></div></div>;

  return (
    <div className="content-stack" style={{ maxWidth: 640 }}>
      <div className="panel">
        <h2><MessageSquare size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("teamsIntegrationTitle")}</h2>
        <p className="panel-sub">{t("teamsIntegrationHint")}</p>

        <form onSubmit={handleSave} className="admin-form" style={{ maxWidth: "none" }}>
          <label>{t("teamsWebhookUrl")}</label>
          <input
            value={form.webhook_url || ""} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
            placeholder="https://xxxxx.webhook.office.com/webhookb2/..."
          />
          <p className="settings-meta" style={{ marginTop: 4 }}>{t("teamsWebhookHelp")}</p>

          <label className="multiselect-item" style={{ padding: "10px 0" }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {t("teamsEnableAll")}
          </label>

          <label className="multiselect-item" style={{ padding: "6px 0" }}>
            <input
              type="checkbox" checked={form.notify_teams_all_events}
              onChange={(e) => setForm((f) => ({ ...f, notify_teams_all_events: e.target.checked }))}
            />
            {t("teamsNotifyAllEvents")}
          </label>
          <p className="settings-meta" style={{ marginTop: 0, marginBottom: 8 }}>{t("teamsNotifyAllEventsHelp")}</p>

          <div className="user-form-section" style={{ marginTop: 8 }}>
            <div className="user-form-section-title">{t("teamsDailySummary")}</div>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input
                type="checkbox" checked={form.daily_summary_enabled}
                onChange={(e) => setForm((f) => ({ ...f, daily_summary_enabled: e.target.checked }))}
              />
              {t("teamsDailySummaryEnable")}
            </label>
            <label>{t("teamsDailySummaryTime")}</label>
            <input
              type="time" value={form.daily_summary_time}
              onChange={(e) => setForm((f) => ({ ...f, daily_summary_time: e.target.value }))}
              style={{ maxWidth: 140 }}
            />
            <label className="multiselect-item" style={{ padding: "10px 0 0" }}>
              <input
                type="checkbox" checked={form.missed_followup_alert_enabled}
                onChange={(e) => setForm((f) => ({ ...f, missed_followup_alert_enabled: e.target.checked }))}
              />
              {t("teamsMissedFollowups")}
            </label>
          </div>

          <div className="user-form-section">
            <div className="user-form-section-title">{t("teamsBigPayment")}</div>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input
                type="checkbox" checked={form.big_payment_alert_enabled}
                onChange={(e) => setForm((f) => ({ ...f, big_payment_alert_enabled: e.target.checked }))}
              />
              {t("teamsBigPaymentEnable")}
            </label>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input
                type="checkbox" checked={form.big_payment_alert_all}
                onChange={(e) => setForm((f) => ({ ...f, big_payment_alert_all: e.target.checked }))}
              />
              {t("teamsBigPaymentAll")}
            </label>
            {!form.big_payment_alert_all && (
              <>
                <label>{t("teamsBigPaymentThreshold")}</label>
                <input
                  type="number" min="0" value={form.big_payment_threshold}
                  onChange={(e) => setForm((f) => ({ ...f, big_payment_threshold: parseFloat(e.target.value) || 0 }))}
                  style={{ maxWidth: 160 }}
                />
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </button>
            <button className="btn-secondary" type="button" onClick={handleTest} disabled={testing || !form.webhook_url}>
              <Send size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {testing ? t("sending") : t("teamsSendTest")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
