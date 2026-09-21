import { useEffect, useState } from "react";
import { CalendarClock, Send } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

const WEEKDAYS_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];
const WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ScheduledReportsPanel() {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const weekdays = lang === "ar" ? WEEKDAYS_AR : WEEKDAYS_EN;

  useEffect(() => {
    api.scheduledReportSettings().then(setForm).catch((e) => setError(e.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateScheduledReportSettings(form);
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
      await api.testScheduledReports();
      showToast(t("scheduledReportsTestSent"), "success");
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
        <h2><CalendarClock size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("scheduledReportsTitle")}</h2>
        <p className="panel-sub">{t("scheduledReportsHint")}</p>

        <form onSubmit={handleSave} className="admin-form" style={{ maxWidth: "none" }}>
          <label className="multiselect-item" style={{ padding: "6px 0 14px" }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {t("scheduledReportsEnable")}
          </label>

          <div className="user-form-section">
            <div className="user-form-section-title">{t("scheduledReportsDelivery")}</div>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input type="checkbox" checked={form.deliver_email} onChange={(e) => setForm((f) => ({ ...f, deliver_email: e.target.checked }))} />
              {t("scheduledReportsDeliverEmail")}
            </label>
            {form.deliver_email && (
              <>
                <label>{t("scheduledReportsRecipients")}</label>
                <input
                  value={form.recipient_emails || ""} onChange={(e) => setForm((f) => ({ ...f, recipient_emails: e.target.value }))}
                  placeholder="owner@company.com, manager@company.com"
                />
              </>
            )}
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input type="checkbox" checked={form.deliver_teams} onChange={(e) => setForm((f) => ({ ...f, deliver_teams: e.target.checked }))} />
              {t("scheduledReportsDeliverTeams")}
            </label>
            <p className="settings-meta" style={{ marginTop: 0 }}>{t("scheduledReportsTeamsHint")}</p>
          </div>

          <div className="user-form-section">
            <div className="user-form-section-title">{t("scheduledReportsWeekly")}</div>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input
                type="checkbox" checked={form.weekly_collections_enabled}
                onChange={(e) => setForm((f) => ({ ...f, weekly_collections_enabled: e.target.checked }))}
              />
              {t("scheduledReportsWeeklyEnable")}
            </label>
            {form.weekly_collections_enabled && (
              <div className="more-filters-row">
                <div className="more-filter-field">
                  <label>{t("scheduledReportsWeekday")}</label>
                  <select
                    value={form.weekly_collections_weekday}
                    onChange={(e) => setForm((f) => ({ ...f, weekly_collections_weekday: parseInt(e.target.value) }))}
                  >
                    {weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
                  </select>
                </div>
                <div className="more-filter-field">
                  <label>{t("scheduledReportsTime")}</label>
                  <input
                    type="time" value={form.weekly_collections_time}
                    onChange={(e) => setForm((f) => ({ ...f, weekly_collections_time: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="user-form-section">
            <div className="user-form-section-title">{t("scheduledReportsMonthly")}</div>
            <label className="multiselect-item" style={{ padding: "6px 0" }}>
              <input
                type="checkbox" checked={form.monthly_performance_enabled}
                onChange={(e) => setForm((f) => ({ ...f, monthly_performance_enabled: e.target.checked }))}
              />
              {t("scheduledReportsMonthlyEnable")}
            </label>
            {form.monthly_performance_enabled && (
              <div className="more-filters-row">
                <div className="more-filter-field">
                  <label>{t("scheduledReportsDayOfMonth")}</label>
                  <input
                    type="number" min="1" max="28" value={form.monthly_performance_day}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_performance_day: parseInt(e.target.value) || 1 }))}
                    style={{ maxWidth: 90 }}
                  />
                </div>
                <div className="more-filter-field">
                  <label>{t("scheduledReportsTime")}</label>
                  <input
                    type="time" value={form.monthly_performance_time}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_performance_time: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </button>
            <button className="btn-secondary" type="button" onClick={handleTest} disabled={testing}>
              <Send size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {testing ? t("sending") : t("scheduledReportsSendNow")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
