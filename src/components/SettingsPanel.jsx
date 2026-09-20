import { useEffect, useState } from "react";
import { PlugZap, Save, ClipboardList, Plus, Trash2, Pencil } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDateTime } from "../dateUtils.js";

const TONE_OPTIONS = ["faint", "ok", "warn", "danger"];
const toggleInArr = (arr, val) => arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

function FollowupStatusManager() {
  const { t, statusLabel } = useLang();
  const { showToast } = useToast();
  const [statuses, setStatuses] = useState(null);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", tone: "faint", requires_next_date: false, notify_admin: false, notify_collector: false, requires_payment_details: false, allowedFrom: [], allowedTo: [] });
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.followupStatuses().then(setStatuses).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const startEdit = (s) => {
    setEditingId(s.id);
    setShowNewForm(false);
    setForm({
      name: s.name, tone: s.tone, requires_next_date: s.requires_next_date, notify_admin: s.notify_admin,
      notify_collector: s.notify_collector, requires_payment_details: s.requires_payment_details,
      allowedFrom: (s.allowed_from_statuses || "").split(",").map((x) => x.trim()).filter(Boolean),
      allowedTo: (s.allowed_to_statuses || "").split(",").map((x) => x.trim()).filter(Boolean),
    });
  };

  const startNew = () => {
    setEditingId(null);
    setShowNewForm(true);
    setForm({ name: "", tone: "faint", requires_next_date: false, notify_admin: false, notify_collector: false, requires_payment_details: false, allowedFrom: [], allowedTo: [] });
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNewForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name, tone: form.tone, requires_next_date: form.requires_next_date, notify_admin: form.notify_admin,
      notify_collector: form.notify_collector, requires_payment_details: form.requires_payment_details,
      allowed_from_statuses: form.allowedFrom.join(",") || null,
      allowed_to_statuses: form.allowedTo.join(",") || null,
    };
    try {
      if (editingId) {
        await api.updateFollowupStatus(editingId, payload);
      } else {
        await api.createFollowupStatus(payload);
      }
      cancelForm();
      load();
      showToast(t("exportReady"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteFollowupStatus(id);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="panel">
      <h2><ClipboardList size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("manageFollowupStatuses")}</h2>
      <p className="panel-sub">{t("manageFollowupStatusesHint")}</p>

      {error && <div className="error-state">{error}</div>}
      {!statuses && !error && <div className="loading-state">{t("loadingDots")}</div>}

      {statuses && (
        <div className="status-config-list">
          {statuses.map((s) => (
            <div className="status-config-row" key={s.id}>
              <span className={`fu-tag sm ${s.tone}`}>{statusLabel(s.name)}</span>
              <div className="status-config-rules">
                {s.requires_next_date && <span className="status-rule-badge">{t("ruleRequiresDate")}</span>}
                {s.requires_payment_details && <span className="status-rule-badge">{t("ruleRequiresPaymentDetails")}</span>}
                {s.notify_admin && <span className="status-rule-badge">{t("ruleNotifyAdmin")}</span>}
                {s.notify_collector && <span className="status-rule-badge">{t("ruleNotifyCollector")}</span>}
                {s.allowed_from_statuses && (
                  <span className="status-rule-badge workflow">
                    {t("ruleOnlyAfter")}: {s.allowed_from_statuses.split(",").map((n) => statusLabel(n.trim())).join(", ")}
                  </span>
                )}
                {s.allowed_to_statuses && (
                  <span className="status-rule-badge workflow">
                    {t("ruleOnlyBefore")}: {s.allowed_to_statuses.split(",").map((n) => statusLabel(n.trim())).join(", ")}
                  </span>
                )}
              </div>
              <div className="row-actions">
                <button className="icon-btn" title={t("edit")} onClick={() => startEdit(s)}>
                  <Pencil size={13} />
                </button>
                <button className="icon-btn danger" title={t("deleteTemplate")} onClick={() => handleDelete(s.id)} disabled={statuses.length <= 1}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


      {!showNewForm && editingId === null && (
        <button type="button" className="btn-secondary sm" style={{ marginTop: 12 }} onClick={startNew}>
          <Plus size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
          {t("addStatus")}
        </button>
      )}

      {(showNewForm || editingId !== null) && (
        <form onSubmit={handleSubmit} className="admin-form" style={{ marginTop: 14, maxWidth: 360 }}>
          <label>{t("statusName")}</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("templateNamePlaceholder")} />

          <label>{t("badgeColor")}</label>
          <select value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}>
            {TONE_OPTIONS.map((tone) => (
              <option key={tone} value={tone}>{t(`tone_${tone}`)}</option>
            ))}
          </select>

          <label className="multiselect-item" style={{ padding: "8px 0" }}>
            <input
              type="checkbox"
              checked={form.requires_next_date}
              onChange={(e) => setForm((f) => ({ ...f, requires_next_date: e.target.checked }))}
            />
            {t("ruleRequiresDate")}
          </label>
          <label className="multiselect-item" style={{ padding: "8px 0" }}>
            <input
              type="checkbox"
              checked={form.requires_payment_details}
              onChange={(e) => setForm((f) => ({ ...f, requires_payment_details: e.target.checked }))}
            />
            {t("ruleRequiresPaymentDetails")}
          </label>
          <label className="multiselect-item" style={{ padding: "8px 0" }}>
            <input
              type="checkbox"
              checked={form.notify_admin}
              onChange={(e) => setForm((f) => ({ ...f, notify_admin: e.target.checked }))}
            />
            {t("ruleNotifyAdmin")}
          </label>
          <label className="multiselect-item" style={{ padding: "8px 0" }}>
            <input
              type="checkbox"
              checked={form.notify_collector}
              onChange={(e) => setForm((f) => ({ ...f, notify_collector: e.target.checked }))}
            />
            {t("ruleNotifyCollector")}
          </label>

          <label>{t("ruleOnlyAfter")}</label>
          <p className="settings-meta" style={{ margin: "0 0 6px" }}>{t("ruleOnlyAfterHint")}</p>
          <div className="multiselect-list">
            {statuses && statuses.filter((s) => s.name !== form.name).map((s) => (
              <label key={s.id} className="multiselect-item">
                <input
                  type="checkbox"
                  checked={form.allowedFrom.includes(s.name)}
                  onChange={() => setForm((f) => ({ ...f, allowedFrom: toggleInArr(f.allowedFrom, s.name) }))}
                />
                {statusLabel(s.name)}
              </label>
            ))}
          </div>

          <label>{t("ruleOnlyBefore")}</label>
          <p className="settings-meta" style={{ margin: "0 0 6px" }}>{t("ruleOnlyBeforeHint")}</p>
          <div className="multiselect-list">
            {statuses && statuses.filter((s) => s.name !== form.name).map((s) => (
              <label key={s.id} className="multiselect-item">
                <input
                  type="checkbox"
                  checked={form.allowedTo.includes(s.name)}
                  onChange={() => setForm((f) => ({ ...f, allowedTo: toggleInArr(f.allowedTo, s.name) }))}
                />
                {statusLabel(s.name)}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="btn-primary sm" type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </button>
            <button type="button" className="btn-secondary sm" onClick={cancelForm}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPanel({ onSaved }) {
  const { t } = useLang();
  const [current, setCurrent] = useState(null);
  const [odooUrl, setOdooUrl] = useState("");
  const [odooDb, setOdooDb] = useState("");
  const [odooUsername, setOdooUsername] = useState("");
  const [odooApiKey, setOdooApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    api.getOdooSettings()
      .then((s) => {
        setCurrent(s);
        if (s.configured) {
          setOdooUrl(s.odoo_url);
          setOdooDb(s.odoo_db);
          setOdooUsername(s.odoo_username);
        }
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      await api.saveOdooSettings({
        odoo_url: odooUrl, odoo_db: odooDb, odoo_username: odooUsername, odoo_api_key: odooApiKey,
      });
      setOdooApiKey("");
      load();
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await api.testOdooSettings();
      setTestResult(`Connected — Odoo server ${res.server_version}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="content-stack">
      <div className="panel">
        <h2>{t("odooConnection")}</h2>
        <p className="panel-sub">{t("odooConnectionHint")}</p>

        {current?.configured && (
          <div className="settings-meta">
            {t("lastSavedBy")} {current.updated_by || "—"} ·{" "}
            {current.updated_at ? fmtDateTime(current.updated_at) : "—"}
          </div>
        )}

        <form onSubmit={handleSave} className="admin-form">
          <label>{t("odooUrl")}</label>
          <input value={odooUrl} onChange={(e) => setOdooUrl(e.target.value)} placeholder="https://db.swag.com.sa" />
          <label>{t("database")}</label>
          <input value={odooDb} onChange={(e) => setOdooDb(e.target.value)} placeholder="db2" />
          <label>{t("odooUsername")}</label>
          <input value={odooUsername} onChange={(e) => setOdooUsername(e.target.value)} placeholder="a.saber@swag.com.sa" />
          <label>{t("apiKey")} {current?.configured ? t("keepCurrent") : ""}</label>
          <input
            type="password"
            value={odooApiKey}
            onChange={(e) => setOdooApiKey(e.target.value)}
            placeholder={current?.configured ? current.odoo_api_key_masked : t("apiKey")}
          />

          {error && <div className="error-state">{error}</div>}
          {testResult && <div className="success-state">{testResult}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              <Save size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              {saving ? t("saving") : t("saveSettings")}
            </button>
            {current?.configured && (
              <button type="button" className="btn-secondary" onClick={handleTest} disabled={testing}>
                <PlugZap size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                {testing ? t("testing") : t("testConnection")}
              </button>
            )}
          </div>
        </form>
      </div>
      <FollowupStatusManager />
      <AutomationSettingsForm />
    </div>
  );
}

function AutomationSettingsForm() {
  const { t } = useLang();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAutomationSettings().then((s) => setEnabled(s.auto_close_paid_customers)).catch(() => {});
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await api.saveAutomationSettings({ auto_close_paid_customers: next });
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h2>{t("automationSettingsTitle")}</h2>
      <p className="panel-sub">{t("automationSettingsHint")}</p>
      <label className="settings-toggle-row">
        <input type="checkbox" checked={enabled} onChange={handleToggle} disabled={saving} />
        <span>{t("autoCloseToggleLabel")}</span>
      </label>
    </div>
  );
}
