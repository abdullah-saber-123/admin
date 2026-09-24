import { useEffect, useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";

const TRACKS = ["note", "contract", "credit_limit", "final"];

function emptyStep() {
  return { name: "", track: "contract", step_order: 0, assigned_username: "", active: true };
}

export default function ApprovalStepsSettings() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [steps, setSteps] = useState(null);
  const [users, setUsers] = useState([]);
  const [newStep, setNewStep] = useState(emptyStep());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    api.listApprovalSteps().then(setSteps).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStep.name.trim()) return;
    setSaving(true);
    try {
      await api.createApprovalStep({ ...newStep, assigned_username: newStep.assigned_username || null, step_order: Number(newStep.step_order) || 0 });
      setNewStep(emptyStep());
      load();
      showToast(t("saved"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const updateStep = async (step, changes) => {
    try {
      await api.updateApprovalStep(step.id, { ...step, ...changes });
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteApprovalStep(id);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (error) return <div className="content-stack"><div className="panel"><div className="error-state">{error}</div></div></div>;
  if (!steps) return <div className="content-stack"><div className="panel"><div className="loading-state">{t("loadingDots")}</div></div></div>;

  return (
    <div className="content-stack" style={{ maxWidth: 800 }}>
      <div className="panel">
        <h2><ListChecks size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("approvalStepsTitle")}</h2>
        <p className="panel-sub">{t("approvalStepsHint")}</p>

        <div className="table-wrap" style={{ marginTop: 14, marginBottom: 18 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("approvalStepOrder")}</th>
                <th>{t("approvalStepName")}</th>
                <th>{t("approvalStepTrack")}</th>
                <th>{t("approvalStepAssignee")}</th>
                <th>{t("approvalStepActive")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td><input type="number" className="cost-of-debt-input" value={s.step_order} style={{ width: 60 }}
                    onChange={(e) => updateStep(s, { step_order: Number(e.target.value) || 0 })} /></td>
                  <td><input className="cost-of-debt-input" value={s.name} style={{ width: 180 }}
                    onChange={(e) => updateStep(s, { name: e.target.value })} /></td>
                  <td>
                    <select value={s.track} onChange={(e) => updateStep(s, { track: e.target.value })}>
                      {TRACKS.map((tr) => <option key={tr} value={tr}>{t(`approvalTrack_${tr}`)}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={s.assigned_username || ""} onChange={(e) => updateStep(s, { assigned_username: e.target.value || null })}>
                      <option value="">{t("approvalStepAnyAdmin")}</option>
                      {users.map((u) => <option key={u.id} value={u.username}>{u.full_name || u.username}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" checked={s.active} onChange={(e) => updateStep(s, { active: e.target.checked })} />
                  </td>
                  <td><button className="icon-btn danger" onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAdd} className="more-filters-row" style={{ alignItems: "flex-end" }}>
          <div className="more-filter-field">
            <label>{t("approvalStepOrder")}</label>
            <input type="number" value={newStep.step_order} style={{ width: 70 }}
              onChange={(e) => setNewStep((s) => ({ ...s, step_order: e.target.value }))} />
          </div>
          <div className="more-filter-field" style={{ minWidth: 180 }}>
            <label>{t("approvalStepName")}</label>
            <input value={newStep.name} onChange={(e) => setNewStep((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="more-filter-field">
            <label>{t("approvalStepTrack")}</label>
            <select value={newStep.track} onChange={(e) => setNewStep((s) => ({ ...s, track: e.target.value }))}>
              {TRACKS.map((tr) => <option key={tr} value={tr}>{t(`approvalTrack_${tr}`)}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("approvalStepAssignee")}</label>
            <select value={newStep.assigned_username} onChange={(e) => setNewStep((s) => ({ ...s, assigned_username: e.target.value }))}>
              <option value="">{t("approvalStepAnyAdmin")}</option>
              {users.map((u) => <option key={u.id} value={u.username}>{u.full_name || u.username}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <button className="btn-primary" type="submit" disabled={saving}>
              <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
              {t("approvalStepAdd")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
