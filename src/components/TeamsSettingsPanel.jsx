import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ListOrdered } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

function TeamsCardPreview({ t }) {
  return (
    <div style={{
      display: "flex", gap: 0, borderRadius: 8, overflow: "hidden",
      border: "1px solid var(--border)", background: "var(--panel)", maxWidth: 460,
    }}>
      <div style={{ width: 4, background: "#2E7D32", flexShrink: 0 }} />
      <div style={{ padding: "10px 14px", fontSize: 12.5, lineHeight: 1.9 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>💰 Payment Received</div>
        <div><strong>Customer:</strong> شركة الأمل التجارية</div>
        <div><strong>Amount:</strong> 12,500.00 SAR (Bank Transfer)</div>
        <div><strong>Collector:</strong> أحمد السالم</div>
        <div><strong>Remaining Balance:</strong> 34,200.00 SAR</div>
        <div><strong>Logged by:</strong> admin</div>
      </div>
    </div>
  );
}

function PerCollectorRow({ user }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [value, setValue] = useState(user.teams_webhook_url || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const saveTimer = useRef(null);

  const scheduleSave = (nextValue) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.updateUserTeamsWebhook(user.id, nextValue);
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setSaving(false);
      }
    }, 700);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.testUserTeamsWebhook(user.id);
      showToast(t("teamsTestSent"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <tr>
      <td data-label={t("collectorField")}>{user.full_name || user.username}</td>
      <td data-label={t("teamsPerCollectorWebhook")}>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); scheduleSave(e.target.value); }}
          placeholder="https://xxxxx.webhook.office.com/webhookb2/..."
          style={{ width: "100%", minWidth: 220 }}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {saving && <span className="settings-meta">{t("saving")}</span>}
        <button className="btn-secondary sm" type="button" onClick={handleTest} disabled={testing || !value}>
          <Send size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
          {testing ? t("sending") : t("teamsSendTest")}
        </button>
      </td>
    </tr>
  );
}

export default function TeamsSettingsPanel() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    api.teamsSettings().then(setForm).catch((e) => setError(e.message));
    api.listUsers().then((users) => setStaff(users.filter((u) => u.role !== "admin"))).catch(() => {});
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
    <div className="content-stack" style={{ maxWidth: 720 }}>
      <div className="panel">
        <h2><MessageSquare size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("teamsIntegrationTitle")}</h2>
        <p className="panel-sub">{t("teamsIntegrationHint")}</p>

        <div className="panel" style={{ marginTop: 14, marginBottom: 14, background: "var(--card)" }}>
          <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>
            <ListOrdered size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("teamsHowToTitle")}
          </h3>
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 12.5, lineHeight: 2, color: "var(--text-dim)" }}>
            <li>{t("teamsHowToStep1")}</li>
            <li>{t("teamsHowToStep2")}</li>
            <li>{t("teamsHowToStep3")}</li>
            <li>{t("teamsHowToStep4")}</li>
            <li>{t("teamsHowToStep5")}</li>
            <li>{t("teamsHowToStep6")}</li>
          </ol>
        </div>

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

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <h3 className="insights-chart-title" style={{ marginBottom: 4 }}>{t("teamsPreviewTitle")}</h3>
          <p className="panel-sub" style={{ marginBottom: 10 }}>{t("teamsPreviewHint")}</p>
          <TeamsCardPreview t={t} />
        </div>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <h3 className="insights-chart-title" style={{ marginBottom: 4 }}>{t("teamsPerCollectorTitle")}</h3>
          <p className="panel-sub" style={{ marginBottom: 10 }}>{t("teamsPerCollectorHint")}</p>
          {!staff && <div className="loading-state">{t("loadingDots")}</div>}
          {staff && staff.length === 0 && <div className="empty-state">{t("teamsNoStaffYet")}</div>}
          {staff && staff.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("collectorField")}</th>
                    <th>{t("teamsPerCollectorWebhook")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((u) => <PerCollectorRow key={u.id} user={u} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
