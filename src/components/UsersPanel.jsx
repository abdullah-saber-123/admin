import { useEffect, useState } from "react";
import { UserPlus, Trash2, KeyRound, Link2, ShieldCheck, Phone, Users2, ShieldHalf, UserCog, UserX, Search, Tag, Globe, Pencil } from "lucide-react";
import { api, getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import PromptModal from "./PromptModal.jsx";
import Avatar from "./Avatar.jsx";

const toggleInArray = (arr, val) => arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
const PERMISSION_OPTIONS = [
  "reports", "trends", "costOfDebt", "customerScore", "customerAnalytics", "customerOwnAnalysis", "reminders",
  "portalManagement", "invoices", "creditNomination", "paymentProofs", "brokenPromises", "debtWriteOffs",
  "customerRetargeting", "reconciliations", "discounts", "customerComparison", "contractCases",
];
const PERMISSION_LABEL_KEYS = {
  reports: "permCollectorReports", trends: "permTrends",
  costOfDebt: "costOfDebtTitle", customerScore: "customerScoreTitle",
  customerAnalytics: "customerAnalyticsTitle",
  customerOwnAnalysis: "permCustomerOwnAnalysis",
  reminders: "remindersOverviewTitle",
  portalManagement: "portalManagementTitle", invoices: "invoicesReportTitle",
  creditNomination: "creditNominationTitle", paymentProofs: "paymentProofsTitle",
  brokenPromises: "brokenPromisesTitle", debtWriteOffs: "debtWriteOffsTitle",
  customerRetargeting: "retargetingTitle",
  reconciliations: "reconciliationsTitle",
  discounts: "discountsTitle",
  customerComparison: "comparisonTitle",
  contractCases: "contractCasesTitle",
};

export default function UsersPanel({ onOpenUserProfile }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [users, setUsers] = useState(null);
  const [salespersons, setSalespersons] = useState([]);
  const [error, setError] = useState(null);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [linkedSalespersons, setLinkedSalespersons] = useState([]);
  const [newUserFullAccess, setNewUserFullAccess] = useState(false);
  const [newUserPermissions, setNewUserPermissions] = useState([]);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [permissionsTarget, setPermissionsTarget] = useState(null);
  const [delayReasonsTarget, setDelayReasonsTarget] = useState(null);
  const [delayReasonOptions, setDelayReasonOptions] = useState([]);
  const [phoneTarget, setPhoneTarget] = useState(null);
  const [fullNameTarget, setFullNameTarget] = useState(null);
  const [search, setSearch] = useState("");

  const me = getSession()?.username;

  const load = () => {
    api.listUsers().then(setUsers).catch((e) => setError(e.message));
    api.listSalespersons().then(setSalespersons).catch(() => {});
    api.invoiceDelayReasons().then(setDelayReasonOptions).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.createUser({
        username, password, role, full_name: fullName || null,
        linked_salesperson: role === "staff" ? (linkedSalespersons.join(", ") || null) : null,
        full_customer_access: role === "staff" ? newUserFullAccess : false,
        permissions: role === "staff" ? (newUserPermissions.join(",") || null) : null,
      });
      setUsername(""); setFullName(""); setPassword(""); setRole("staff"); setLinkedSalespersons([]); setNewUserFullAccess(false); setNewUserPermissions([]);
      load();
      showToast(`${username} created.`, "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      load();
      showToast("User removed.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleResetPassword = async (pw) => {
    if (!pw) return;
    try {
      await api.resetUserPassword(passwordTarget.id, pw);
      setPasswordTarget(null);
      showToast("Password updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleReassign = async (value) => {
    try {
      await api.assignUserCollector(reassignTarget.id, (value || "").trim());
      setReassignTarget(null);
      load();
      showToast("Collector assignment updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handlePermissionsUpdate = async (value) => {
    try {
      await api.updateUserPermissions(permissionsTarget.id, (value || "").trim());
      setPermissionsTarget(null);
      load();
      showToast("Permissions updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDelayReasonsUpdate = async (value) => {
    try {
      await api.updateUserDelayReasons(delayReasonsTarget.id, (value || "").trim());
      setDelayReasonsTarget(null);
      load();
      showToast("Allowed delay reasons updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handlePhoneUpdate = async (value) => {
    try {
      await api.updateUserPhone(phoneTarget.id, (value || "").trim());
      setPhoneTarget(null);
      load();
      showToast("Phone number updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleFullNameUpdate = async (value) => {
    try {
      await api.updateUserFullName(fullNameTarget.id, (value || "").trim());
      setFullNameTarget(null);
      load();
      showToast(t("saved"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const visibleUsers = (users || []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q)
      || (u.full_name || "").toLowerCase().includes(q)
      || (u.linked_salesperson || "").toLowerCase().includes(q);
  });

  const adminCount = (users || []).filter((u) => u.role === "admin").length;
  const staffCount = (users || []).filter((u) => u.role === "staff").length;
  const unassignedCount = (users || []).filter((u) => u.role === "staff" && !u.linked_salesperson).length;

  return (
    <div className="content-stack">
      {users && users.length > 0 && (
        <div className="insights-panel">
          <h3 className="insights-panel-title">{t("usersOverviewTitle")}</h3>
          <div className="insights-kpi-grid">
            <div className="insights-kpi-card accent-violet">
              <span className="kpi-pulse kpi-pulse-lg" />
              <span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("totalUsersLabel")}</div>
                <div className="insights-kpi-icon"><Users2 size={15} /></div>
              </div>
              <div className="insights-kpi-value">{users.length}</div>
              <div className="insights-kpi-bar" />
            </div>
            <div className="insights-kpi-card accent-teal">
              <span className="kpi-pulse kpi-pulse-lg" />
              <span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("roleAdmin")}</div>
                <div className="insights-kpi-icon"><ShieldHalf size={15} /></div>
              </div>
              <div className="insights-kpi-value">{adminCount}</div>
              <div className="insights-kpi-bar" />
            </div>
            <div className="insights-kpi-card accent-amber">
              <span className="kpi-pulse kpi-pulse-lg" />
              <span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("roleStaff")}</div>
                <div className="insights-kpi-icon"><UserCog size={15} /></div>
              </div>
              <div className="insights-kpi-value">{staffCount}</div>
              <div className="insights-kpi-bar" />
            </div>
            <div className="insights-kpi-card accent-danger">
              <span className="kpi-pulse kpi-pulse-lg" />
              <span className="kpi-pulse kpi-pulse-sm" />
              <div className="insights-kpi-top">
                <div className="insights-kpi-label">{t("unassignedStaffLabel")}</div>
                <div className="insights-kpi-icon"><UserX size={15} /></div>
              </div>
              <div className="insights-kpi-value">{unassignedCount}</div>
              <div className="insights-kpi-bar" />
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>{t("addUser")}</h2>
        <p className="panel-sub">{t("addUserHint")}</p>
        <form onSubmit={handleCreate} className="user-create-form">
          <div className="user-form-section">
            <div className="user-form-section-title">{t("accountDetailsTitle")}</div>
            <div className="user-create-grid">
              <div>
                <label>{t("username")}</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div>
                <label>{t("fullName")}</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label>{t("password")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <label>{t("role")}</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="staff">{t("roleStaff")}</option>
                  <option value="admin">{t("roleAdmin")}</option>
                </select>
              </div>
            </div>
          </div>

          {role === "staff" && (
            <div className="user-form-section">
              <div className="user-form-section-title">{t("accessSectionTitle")}</div>
              <p className="user-form-section-hint">{t("accessSectionHint")}</p>
              <div className="user-create-lists">
                <div className="user-form-box">
                  <div className="user-form-box-head">
                    <span>{t("collectorField")}</span>
                    {linkedSalespersons.length > 0 && <span className="user-form-box-count">{linkedSalespersons.length}</span>}
                  </div>
                  <label className="multiselect-item" style={{ borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="checkbox"
                      checked={newUserFullAccess}
                      onChange={(e) => setNewUserFullAccess(e.target.checked)}
                    />
                    {t("fullCustomerAccessLabel")}
                  </label>
                  {newUserFullAccess ? (
                    <div className="settings-meta" style={{ padding: "10px 12px" }}>{t("fullCustomerAccessHint")}</div>
                  ) : salespersons.length === 0 ? (
                    <div className="settings-meta" style={{ padding: "10px 12px" }}>{t("chooseAfterSync")}</div>
                  ) : (
                    <div className="multiselect-list" style={{ maxHeight: 160 }}>
                      {salespersons.map((s) => (
                        <label key={s} className="multiselect-item">
                          <input
                            type="checkbox"
                            checked={linkedSalespersons.includes(s)}
                            onChange={() => setLinkedSalespersons((arr) => toggleInArray(arr, s))}
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="user-form-box">
                  <div className="user-form-box-head">
                    <span>{t("extraPermissions")}</span>
                    {newUserPermissions.length > 0 && <span className="user-form-box-count">{newUserPermissions.length}</span>}
                  </div>
                  <div className="multiselect-list" style={{ maxHeight: 160 }}>
                    {PERMISSION_OPTIONS.map((p) => (
                      <label key={p} className="multiselect-item">
                        <input
                          type="checkbox"
                        checked={newUserPermissions.includes(p)}
                        onChange={() => setNewUserPermissions((arr) => toggleInArray(arr, p))}
                      />
                      {t(PERMISSION_LABEL_KEYS[p])}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          <button className="btn-primary" type="submit" disabled={creating} style={{ marginTop: 14 }}>
            <UserPlus size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
            {creating ? t("creating") : t("createUser")}
          </button>
        </form>
        {salespersons.length === 0 && (
          <div className="settings-meta" style={{ marginTop: 10 }}>
            {t("noSalespersons")}
          </div>
        )}
        {error && <div className="error-state">{error}</div>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t("allUsers")}</h2>
          <div className="search-bar" style={{ maxWidth: 260 }}>
            <div className="input-icon compact">
              <Search size={15} />
              <input placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        {!users && <div className="loading-state">{t("loadingDots")}</div>}
        {users && visibleUsers.length === 0 && <div className="empty-state">{t("noMatch")}</div>}
        {users && visibleUsers.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("username")}</th>
                  <th>{t("fullName")}</th>
                  <th>{t("role")}</th>
                  <th>{t("assignedCollector")}</th>
                  <th>{t("created")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id}>
                    <td onClick={() => onOpenUserProfile?.(u.id)} className="user-row-name-cell">
                      <div className="cust-cell">
                        <Avatar name={u.full_name || u.username} src={u.avatar_url} size="sm" />
                        <span className="cust-name">{u.username}{u.username === me ? " *" : ""}</span>
                      </div>
                    </td>
                    <td onClick={() => onOpenUserProfile?.(u.id)} className="user-row-name-cell">{u.full_name || "—"}</td>
                    <td><span className={`role-tag ${u.role}`}>{u.role === "admin" ? t("roleAdmin") : t("roleStaff")}</span></td>
                    <td>
                      {u.role === "admin" || u.full_customer_access ? (
                        <span style={{ color: "var(--text-faint)" }}>{t("allCustomers")}</span>
                      ) : (
                        u.linked_salesperson || <span style={{ color: "var(--danger)" }}>{t("unassigned")}</span>
                      )}
                    </td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        {u.role === "staff" && (
                          <button className="icon-btn" title="Assign collector" onClick={() => setReassignTarget(u)}>
                            <Link2 size={14} />
                          </button>
                        )}
                        {u.role === "staff" && (
                          <button
                            className={`icon-btn ${u.full_customer_access ? "active-toggle" : ""}`}
                            title={t("fullCustomerAccessLabel")}
                            onClick={async () => {
                              try {
                                await api.setUserFullCustomerAccess(u.id, !u.full_customer_access);
                                load();
                              } catch (e) {
                                showToast(e.message, "error");
                              }
                            }}
                          >
                            <Globe size={14} />
                          </button>
                        )}
                        {u.role === "staff" && (
                          <button className="icon-btn" title={t("editPermissions")} onClick={() => setPermissionsTarget(u)}>
                            <ShieldCheck size={14} />
                          </button>
                        )}
                        {u.role === "staff" && (
                          <button className="icon-btn" title={t("allowedDelayReasonsTitle")} onClick={() => setDelayReasonsTarget(u)}>
                            <Tag size={14} />
                          </button>
                        )}
                        <button className="icon-btn" title={t("fullName")} onClick={() => setFullNameTarget(u)}>
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" title={t("collectorPhoneLabel")} onClick={() => setPhoneTarget(u)}>
                          <Phone size={14} />
                        </button>
                        <button className="icon-btn" title="Reset password" onClick={() => setPasswordTarget(u)}>
                          <KeyRound size={14} />
                        </button>
                        <button className="icon-btn danger" title="Remove user" onClick={() => setDeleteTarget(u)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PromptModal
        open={!!deleteTarget}
        title="Remove user"
        type="confirm"
        message={deleteTarget ? `Remove ${deleteTarget.username}? They won't be able to log in anymore.` : ""}
        confirmLabel="Remove"
        danger
        onSubmit={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <PromptModal
        open={!!passwordTarget}
        title="Reset password"
        type="password"
        label={passwordTarget ? `New password for ${passwordTarget.username}` : ""}
        onSubmit={handleResetPassword}
        onCancel={() => setPasswordTarget(null)}
      />

      <PromptModal
        open={!!reassignTarget}
        title="Assign collector(s)"
        type="multiselect"
        label={reassignTarget ? `Assign ${reassignTarget.username} to which collector(s)?` : ""}
        initialValue={reassignTarget?.linked_salesperson || ""}
        options={salespersons}
        onSubmit={handleReassign}
        onCancel={() => setReassignTarget(null)}
      />

      <PromptModal
        open={!!permissionsTarget}
        title={t("editPermissions")}
        type="multiselect"
        label={permissionsTarget ? `${t("extraPermissions")}: ${permissionsTarget.username}` : ""}
        initialValue={permissionsTarget?.permissions || ""}
        options={PERMISSION_OPTIONS}
        optionLabels={Object.fromEntries(PERMISSION_OPTIONS.map((p) => [p, t(PERMISSION_LABEL_KEYS[p])]))}
        onSubmit={(value) => handlePermissionsUpdate((value || "").trim())}
        onCancel={() => setPermissionsTarget(null)}
      />

      <PromptModal
        open={!!delayReasonsTarget}
        title={t("allowedDelayReasonsTitle")}
        type="multiselect"
        label={delayReasonsTarget ? `${t("allowedDelayReasonsLabel")}: ${delayReasonsTarget.username}` : ""}
        initialValue={delayReasonsTarget?.allowed_delay_reasons || ""}
        options={delayReasonOptions}
        onSubmit={(value) => handleDelayReasonsUpdate((value || "").trim())}
        onCancel={() => setDelayReasonsTarget(null)}
      />

      <PromptModal
        open={!!phoneTarget}
        title={t("collectorPhoneLabel")}
        type="text"
        label={phoneTarget ? `${t("collectorPhoneLabel")}: ${phoneTarget.username}` : ""}
        initialValue={phoneTarget?.phone || ""}
        placeholder="+9665XXXXXXXX"
        onSubmit={handlePhoneUpdate}
        onCancel={() => setPhoneTarget(null)}
      />

      <PromptModal
        open={!!fullNameTarget}
        title={t("fullName")}
        type="text"
        label={fullNameTarget ? `${t("fullName")}: ${fullNameTarget.username}` : ""}
        initialValue={fullNameTarget?.full_name || ""}
        onSubmit={handleFullNameUpdate}
        onCancel={() => setFullNameTarget(null)}
      />
    </div>
  );
}
