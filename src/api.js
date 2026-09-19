const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export { BASE };
const TOKEN_KEY = "collect_token";
const ROLE_KEY = "collect_role";
const USERNAME_KEY = "collect_username";
const PERMISSIONS_KEY = "collect_permissions";
const IS_SUPERVISOR_KEY = "collect_is_supervisor";

// Builds a ws:// or wss:// URL matching the API's own protocol/host - used for
// the live-call signaling socket.
export function wsUrl(path) {
  const wsBase = BASE.replace(/^http/, "ws");
  return `${wsBase}${path}`;
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return {
    token,
    role: localStorage.getItem(ROLE_KEY),
    username: localStorage.getItem(USERNAME_KEY),
    permissions: localStorage.getItem(PERMISSIONS_KEY) || "",
    is_supervisor: localStorage.getItem(IS_SUPERVISOR_KEY) === "1",
  };
}
export function setSession(token, role, username, permissions = "", isSupervisor = false) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(PERMISSIONS_KEY, permissions || "");
  localStorage.setItem(IS_SUPERVISOR_KEY, isSupervisor ? "1" : "0");
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(PERMISSIONS_KEY);
  localStorage.removeItem(IS_SUPERVISOR_KEY);
}

// Builds a query string, dropping empty/null/undefined values entirely rather than
// sending them as "key=". FastAPI tries to parse every present param against its
// declared type (e.g. Optional[float]) - an empty string fails that validation
// with a 422 whose `detail` is an array of error objects, not a plain string,
// which then rendered as the literal text "[object Object]" in the UI.
function buildQueryString(params = {}) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    usp.set(key, value);
  }
  return usp.toString();
}

// Lets App.jsx know the instant a request comes back 401 (token expired/invalid) so it
// can drop straight back to the login screen instead of the tab silently going stale.
let sessionExpiredHandler = null;
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

async function request(path, options = {}) {
  const session = getSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      const detail = JSON.parse(body).detail;
      // FastAPI validation errors (422) send `detail` as an array of
      // {msg, loc, ...} objects, not a plain string - stringifying that
      // directly renders as the literal text "[object Object]" in the UI.
      if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
      } else if (detail) {
        msg = detail;
      }
    } catch { /* keep raw */ }
    if (res.status === 401) { clearSession(); sessionExpiredHandler?.(); }
    throw new Error(msg || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function requestBlob(path) {
  const session = getSession();
  const headers = {};
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Export failed (${res.status})`);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  // Fallback: guess extension from the request path (or the response's real
  // content-type) instead of always defaulting to .xlsx - in case a proxy or an
  // older browser still doesn't expose Content-Disposition cross-origin.
  const guessedExt = path.includes(".pdf") ? "pdf"
    : (res.headers.get("Content-Type") || "").includes("pdf") ? "pdf"
    : "xlsx";
  const filename = match ? match[1] : `export.${guessedExt}`;
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function fetchFileObjectUrl(path) {
  const session = getSession();
  const headers = {};
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  const blob = await res.blob();
  return { url: window.URL.createObjectURL(blob), type: blob.type };
}

export const api = {
  // auth
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/api/auth/me"),
  changePassword: (current_password, new_password) =>
    request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),

  // data
  kpis: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/kpis${qs ? `?${qs}` : ""}`);
  },
  customers: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/customers?${qs}`);
  },
  customerIds: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/customers/ids?${qs}`);
  },
  cities: () => request("/api/cities"),
  collectors: () => request("/api/collectors"),
  customerDetail: (id, params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/customers/${id}${qs ? `?${qs}` : ""}`);
  },
  updateNotes: (id, notes) =>
    request(`/api/customers/${id}/notes?notes=${encodeURIComponent(notes)}`, { method: "PATCH" }),
  updateAdminNotes: (id, notes) =>
    request(`/api/customers/${id}/admin-notes?notes=${encodeURIComponent(notes)}`, { method: "PATCH" }),
  createPortalAccess: (id) => request(`/api/admin/customers/${id}/portal-access`, { method: "POST" }),
  togglePortalAccess: (id, active) => request(`/api/admin/customers/${id}/portal-access?active=${active}`, { method: "PATCH" }),
  portalAccounts: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/admin/portal-accounts${qs ? `?${qs}` : ""}`);
  },
  bulkCreatePortalAccess: () => request("/api/admin/portal-accounts/bulk-create", { method: "POST" }),
  monthlyReportCustomers: (month) => request(`/api/admin/monthly-report/customers?month=${month}`),
  receivableComparison: (compareDate) => request(`/api/receivable-comparison?compare_date=${compareDate}`),
  teamsSettings: () => request("/api/admin/teams-settings"),
  updateTeamsSettings: (data) => request("/api/admin/teams-settings", { method: "PUT", body: JSON.stringify(data) }),
  testTeamsSettings: () => request("/api/admin/teams-settings/test", { method: "POST" }),
  remindersOverview: (collector = "") => request(`/api/admin/reminders-overview${collector ? `?collector=${encodeURIComponent(collector)}` : ""}`),
  brokenPromisesLog: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/admin/broken-promises${qs ? `?${qs}` : ""}`);
  },
  staffChatContacts: () => request("/api/staff-chat/contacts"),
  getDmThread: (username) => request(`/api/staff-chat/dm/${username}`),
  sendDmMessage: (username, payload) =>
    request(`/api/staff-chat/dm/${username}`, { method: "POST", body: JSON.stringify(payload) }),
  editDmMessage: (username, messageId, message) =>
    request(`/api/staff-chat/dm/${username}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ message }) }),
  deleteDmMessage: (username, messageId) =>
    request(`/api/staff-chat/dm/${username}/messages/${messageId}`, { method: "DELETE" }),
  customerScores: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/admin/customer-scores${qs ? `?${qs}` : ""}`);
  },
  customerAnalyticsOverview: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/admin/customer-analytics/overview${qs ? `?${qs}` : ""}`);
  },
  customerAnalyticsDetail: (partnerId, year) =>
    request(`/api/admin/customer-analytics/${partnerId}${year ? `?year=${year}` : ""}`),
  debtWriteOffs: (status) => request(`/api/admin/debt-write-offs${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  requestDebtWriteOff: (partner_id, reason, amount) =>
    request(`/api/admin/debt-write-offs`, { method: "POST", body: JSON.stringify({ partner_id, reason, amount: amount || null }) }),
  decideDebtWriteOff: (id, approve, note) =>
    request(`/api/admin/debt-write-offs/${id}/decide?approve=${approve}${note ? `&note=${encodeURIComponent(note)}` : ""}`, { method: "PATCH" }),
  reverseDebtWriteOff: (id) => request(`/api/admin/debt-write-offs/${id}/reverse`, { method: "PATCH" }),
  visitRequests: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/visit-requests${qs ? `?${qs}` : ""}`);
  },
  createVisitRequest: (partner_id, reason) =>
    request(`/api/visit-requests`, { method: "POST", body: JSON.stringify({ partner_id, reason }) }),
  assignVisitRequest: (id, assigned_to) =>
    request(`/api/visit-requests/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assigned_to }) }),
  rejectVisitRequest: (id, note) =>
    request(`/api/visit-requests/${id}/reject`, { method: "PATCH", body: JSON.stringify({ note }) }),
  completeVisitRequest: (id, payload) =>
    request(`/api/visit-requests/${id}/complete`, { method: "PATCH", body: JSON.stringify(payload) }),
  retargetCases: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/retarget-cases${qs ? `?${qs}` : ""}`);
  },
  retargetCasesSummary: () => request(`/api/retarget-cases/summary`),
  todayAlerts: () => request(`/api/alerts/today`),
  reconciliations: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reconciliations${qs ? `?${qs}` : ""}`);
  },
  assignReconciliation: (partner_id, assigned_to) =>
    request(`/api/reconciliations/assign`, { method: "POST", body: JSON.stringify({ partner_id, assigned_to }) }),
  matchReconciliation: (id, payload) =>
    request(`/api/reconciliations/${id}/match`, { method: "PATCH", body: JSON.stringify(payload) }),
  reconciliationBalancePreview: (id, as_of_date) =>
    request(`/api/reconciliations/${id}/balance-preview?as_of_date=${as_of_date}`),
  flagReconciliationIssue: (id, payload) =>
    request(`/api/reconciliations/${id}/flag-issue`, { method: "PATCH", body: JSON.stringify(payload) }),
  resolveReconciliationIssue: (id, resolution_note) =>
    request(`/api/reconciliations/${id}/resolve-issue`, { method: "PATCH", body: JSON.stringify({ resolution_note }) }),
  reconciliationProofFile: (id) => fetchFileObjectUrl(`/api/reconciliations/${id}/proof`),
  reconciliationIssueFile: (id) => fetchFileObjectUrl(`/api/reconciliations/${id}/issue-file`),
  reconciliationProofDownload: (id) => requestBlob(`/api/reconciliations/${id}/proof`),
  reconciliationIssueFileDownload: (id) => requestBlob(`/api/reconciliations/${id}/issue-file`),
  reconciliationHistory: (partnerId) => request(`/api/reconciliations/customer/${partnerId}/history`),
  setReconciliationStatementSent: (id, sent) =>
    request(`/api/reconciliations/${id}/statement-sent`, { method: "PATCH", body: JSON.stringify({ sent }) }),
  reconciliationConfirmationPdf: (id, asOfDate, lang) =>
    requestBlob(`/api/reconciliations/${id}/confirmation-pdf?as_of_date=${asOfDate}&lang=${lang}`),
  retargetBranchOptions: () => request(`/api/retarget-cases/branch-options`),
  createRetargetCase: (partner_id, reason) =>
    request(`/api/retarget-cases`, { method: "POST", body: JSON.stringify({ partner_id, reason }) }),
  assignRetargetCase: (id, assigned_to) =>
    request(`/api/retarget-cases/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assigned_to }) }),
  reportRetargetCase: (id, payload) =>
    request(`/api/retarget-cases/${id}/report`, { method: "PATCH", body: JSON.stringify(payload) }),
  resolveRetargetCase: (id, payload) =>
    request(`/api/retarget-cases/${id}/resolve`, { method: "PATCH", body: JSON.stringify(payload) }),
  snoozeRetargetCase: (id, snooze_until) =>
    request(`/api/retarget-cases/${id}/snooze`, { method: "PATCH", body: JSON.stringify({ snooze_until }) }),
  retargetFollowUps: (id) => request(`/api/retarget-cases/${id}/followups`),
  addRetargetFollowUp: (id, note, reminder_date) =>
    request(`/api/retarget-cases/${id}/followups`, { method: "POST", body: JSON.stringify({ note, reminder_date: reminder_date || null }) }),
  invoicesReport: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/invoices${qs ? `?${qs}` : ""}`);
  },
  invoicesReportMonthGroups: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/invoices/month-groups${qs ? `?${qs}` : ""}`);
  },
  invoicesReportReasonGroups: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/invoices/reason-groups${qs ? `?${qs}` : ""}`);
  },
  invoicesReportStatusGroups: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/invoices/status-groups${qs ? `?${qs}` : ""}`);
  },
  invoiceDelayReasons: () => request("/api/reports/invoices/delay-reasons"),
  updateUserPhone: (id, phone) => request(`/api/admin/users/${id}/phone?phone=${encodeURIComponent(phone || "")}`, { method: "PATCH" }),
  myProfile: () => request("/api/me"),
  updateMyProfile: (data) => request("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
  changeMyPassword: (current_password, new_password) =>
    request("/api/me/password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  userProfile: (id) => request(`/api/users/${id}/profile`),
  collectorProfile: (name) => request(`/api/collector-profile?name=${encodeURIComponent(name)}`),
  globalSearch: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),
  loginHistory: () => request("/api/admin/login-history"),
  statementLinks: (partnerIds) => request("/api/statement-links", { method: "POST", body: JSON.stringify({ partner_ids: partnerIds }) }),
  grantTempAccess: (data) => request("/api/temp-access", { method: "POST", body: JSON.stringify(data) }),
  listTempAccess: (partnerId) => request(`/api/temp-access${partnerId ? `?partner_id=${partnerId}` : ""}`),
  respondTempAccess: (id, accept) => request(`/api/temp-access/${id}/respond`, { method: "POST", body: JSON.stringify({ accept }) }),
  revokeTempAccess: (id) => request(`/api/temp-access/${id}`, { method: "DELETE" }),
  staffList: () => request("/api/staff-list"),
  myDay: () => request("/api/my-day"),
  createPaymentPlan: (partnerId, data) => request(`/api/customers/${partnerId}/payment-plans`, { method: "POST", body: JSON.stringify(data) }),
  listCustomerPaymentPlans: (partnerId) => request(`/api/customers/${partnerId}/payment-plans`),
  listAllPaymentPlans: (status) => request(`/api/payment-plans${status ? `?status=${status}` : ""}`),
  updateInstallment: (planId, installmentId, data) => request(`/api/payment-plans/${planId}/installments/${installmentId}`, { method: "PATCH", body: JSON.stringify(data) }),
  cancelPaymentPlan: (planId) => request(`/api/payment-plans/${planId}`, { method: "DELETE" }),
  sendAnnouncement: (data) => request("/api/announcements", { method: "POST", body: JSON.stringify(data) }),
  getPendingAnnouncements: () => request("/api/announcements/pending"),
  acknowledgeAnnouncement: (id, response) => request(`/api/announcements/${id}/acknowledge`, { method: "POST", body: JSON.stringify({ response }) }),
  listAnnouncements: () => request("/api/admin/announcements"),
  myAnnouncementHistory: () => request("/api/announcements/my-history"),
  performanceReport: (period) => request(`/api/reports/performance?period=${period}`),
  exportPerformanceReport: (period) => requestBlob(`/api/reports/performance/export?period=${period}`),
  pushVapidKey: () => request("/api/push/vapid-public-key"),
  pushSubscribe: (data) => request("/api/push/subscribe", { method: "POST", body: JSON.stringify(data) }),
  pushUnsubscribe: (data) => request("/api/push/unsubscribe", { method: "POST", body: JSON.stringify(data) }),
  collectionsReport: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/collections${qs ? `?${qs}` : ""}`);
  },
  paymentProofs: (status = "") => request(`/api/payment-proofs${status ? `?status=${status}` : ""}`),
  reviewPaymentProof: (id, payload) => request(`/api/payment-proofs/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  paymentProofFile: (id) => fetchFileObjectUrl(`/api/payment-proofs/${id}/file`),
  getChat: (id) => request(`/api/customers/${id}/chat`),
  sendChat: (id, message) => request(`/api/customers/${id}/chat`, { method: "POST", body: JSON.stringify({ message }) }),
  updateCreditLimit: (id, credit_limit) =>
    request(`/api/customers/${id}/credit-limit?credit_limit=${credit_limit === null ? "" : encodeURIComponent(credit_limit)}`, { method: "PATCH" }),
  updatePaymentType: (id, payment_type) =>
    request(`/api/customers/${id}/payment-type?payment_type=${payment_type === null ? "" : encodeURIComponent(payment_type)}`, { method: "PATCH" }),
  updateRegion: (id, region) =>
    request(`/api/customers/${id}/region?region=${region === null ? "" : encodeURIComponent(region)}`, { method: "PATCH" }),
  fieldOptions: (field) => request(`/api/customer-field-options?field=${encodeURIComponent(field)}`),
  addFieldOption: (field, value) =>
    request(`/api/customer-field-options`, { method: "POST", body: JSON.stringify({ field, value }) }),
  deleteFieldOption: (id) => request(`/api/customer-field-options/${id}`, { method: "DELETE" }),
  toggleNomination: (id, { for_offer, for_collection } = {}) => {
    const params = [];
    if (for_offer !== undefined) params.push(`for_offer=${for_offer}`);
    if (for_collection !== undefined) params.push(`for_collection=${for_collection}`);
    return request(`/api/customers/${id}/nominate?${params.join("&")}`, { method: "PATCH" });
  },
  logFollowup: (id, payload) =>
    request(`/api/customers/${id}/followups`, { method: "POST", body: JSON.stringify(payload) }),
  bulkLogFollowup: (payload) =>
    request(`/api/admin/customers/bulk-followups`, { method: "POST", body: JSON.stringify(payload) }),
  followupStatuses: () => request("/api/followup-statuses"),
  createFollowupStatus: (payload) => request("/api/admin/followup-statuses", { method: "POST", body: JSON.stringify(payload) }),
  updateFollowupStatus: (id, payload) => request(`/api/admin/followup-statuses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFollowupStatus: (id) => request(`/api/admin/followup-statuses/${id}`, { method: "DELETE" }),
  exportCustomers: (params = {}) => {
    const qs = buildQueryString(params);
    return requestBlob(`/api/export/customers.xlsx${qs ? `?${qs}` : ""}`);
  },
  importCreditLimits: async (file) => {
    const session = getSession();
    const formData = new FormData();
    formData.append("file", file);
    const headers = {};
    if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
    const res = await fetch(`${BASE}/api/admin/credit-limits/import`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = body;
      try {
        const detail = JSON.parse(body).detail;
        msg = Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ") : (detail || body);
      } catch { /* keep raw */ }
      throw new Error(msg || "Import failed.");
    }
    return res.json();
  },
  importPaymentTypes: async (file) => {
    const session = getSession();
    const formData = new FormData();
    formData.append("file", file);
    const headers = {};
    if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
    const res = await fetch(`${BASE}/api/admin/payment-types/import`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = body;
      try {
        const detail = JSON.parse(body).detail;
        msg = Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ") : (detail || body);
      } catch { /* keep raw */ }
      throw new Error(msg || "Import failed.");
    }
    return res.json();
  },
  importRegions: async (file) => {
    const session = getSession();
    const formData = new FormData();
    formData.append("file", file);
    const headers = {};
    if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
    const res = await fetch(`${BASE}/api/admin/regions/import`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = body;
      try {
        const detail = JSON.parse(body).detail;
        msg = Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ") : (detail || body);
      } catch { /* keep raw */ }
      throw new Error(msg || "Import failed.");
    }
    return res.json();
  },
  exportCustomerDetail: (id) => requestBlob(`/api/export/customers/${id}.xlsx`),
  exportStatementPdf: (id, lang) => requestBlob(`/api/customers/${id}/statement.pdf?lang=${lang}`),
  followupDailyPdf: (lang) => requestBlob(`/api/reports/followup-daily-pdf?lang=${lang}`),
  costOfDebt: (id) => request(`/api/customers/${id}/cost-of-debt`),
  costOfDebtReport: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/cost-of-debt${qs ? `?${qs}` : ""}`);
  },
  getCostOfDebtSettings: () => request("/api/admin/cost-of-debt-settings"),
  saveCostOfDebtSettings: (payload) => request("/api/admin/cost-of-debt-settings", { method: "PUT", body: JSON.stringify(payload) }),

  // sync
  syncStatus: () => request("/api/sync/status"),
  triggerSync: () => request("/api/sync", { method: "POST" }),

  // admin: users
  listUsers: () => request("/api/admin/users"),
  createUser: (payload) => request("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id, new_password) =>
    request(`/api/admin/users/${id}/reset-password?new_password=${encodeURIComponent(new_password)}`, { method: "PATCH" }),
  assignUserCollector: (id, linked_salesperson) =>
    request(`/api/admin/users/${id}/assign?linked_salesperson=${encodeURIComponent(linked_salesperson || "")}`, { method: "PATCH" }),
  setUserTarget: (id, monthly_target) =>
    request(`/api/admin/users/${id}/target?monthly_target=${encodeURIComponent(monthly_target)}`, { method: "PATCH" }),
  setUserDailyTarget: (id, daily_collection_target, daily_contact_target) => {
    const params = [];
    params.push(`daily_collection_target=${encodeURIComponent(daily_collection_target || 0)}`);
    params.push(`daily_contact_target=${encodeURIComponent(daily_contact_target || 0)}`);
    return request(`/api/admin/users/${id}/daily-target?${params.join("&")}`, { method: "PATCH" });
  },
  setUserSupervisor: (id, supervisor_username) =>
    request(`/api/admin/users/${id}/supervisor?supervisor_username=${encodeURIComponent(supervisor_username || "")}`, { method: "PATCH" }),
  updateUserPermissions: (id, permissions) =>
    request(`/api/admin/users/${id}/permissions?permissions=${encodeURIComponent(permissions || "")}`, { method: "PATCH" }),
  updateUserDelayReasons: (id, allowed_delay_reasons) =>
    request(`/api/admin/users/${id}/delay-reasons?allowed_delay_reasons=${encodeURIComponent(allowed_delay_reasons || "")}`, { method: "PATCH" }),
  listSalespersons: () => request("/api/admin/salespersons"),
  collectorReport: () => request("/api/admin/collector-report"),
  collectorProfile: (userId) => request(`/api/admin/collector-profile/${userId}`),
  dailyActivityReport: () => request("/api/admin/daily-activity"),
  collectorProfilePdf: (userId, lang) => requestBlob(`/api/admin/collector-profile/${userId}/pdf?lang=${lang}`),
  myPerformancePdf: (lang) => requestBlob(`/api/my-performance/pdf?lang=${lang}`),
  quickCheckin: (partnerId) => request(`/api/customers/${partnerId}/quick-checkin`, { method: "POST" }),
  undoTodayCheckin: (partnerId) => request(`/api/customers/${partnerId}/undo-today`, { method: "DELETE" }),
  snoozeCustomer: (partnerId, hours) => request(`/api/customers/${partnerId}/snooze`, { method: "POST", body: JSON.stringify({ hours }) }),
  clockIn: () => request("/api/attendance/clock-in", { method: "POST" }),
  clockOut: () => request("/api/attendance/clock-out", { method: "POST" }),
  attendanceToday: () => request("/api/attendance/today"),
  adminAttendance: () => request("/api/admin/attendance"),
  dailyActivityPending: (userId) => request(`/api/admin/daily-activity/${userId}/pending`),
  collectorActivityForDate: (userId, targetDate) => request(`/api/admin/collector-activity?user_id=${userId}&target_date=${targetDate}`),
  collectorActivityPdf: (userId, targetDate, lang) => requestBlob(`/api/admin/collector-activity/pdf?user_id=${userId}&target_date=${targetDate}&lang=${lang}`),
  trends: (days = 90) => request(`/api/admin/trends?days=${days}`),
  dueTodayReport: () => request("/api/reports/due-today"),
  followupReport: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/followups${qs ? `?${qs}` : ""}`);
  },
  followupSummary: (params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/reports/followups/summary${qs ? `?${qs}` : ""}`);
  },
  followupCollectors: () => request("/api/reports/followup-collectors"),

  // notifications (@mentions)
  notifications: () => request("/api/notifications"),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "PATCH" }),

  // per-customer activity timeline
  customerActivity: (id, params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/customers/${id}/activity${qs ? `?${qs}` : ""}`);
  },

  // admin: odoo settings
  getOdooSettings: () => request("/api/admin/odoo-settings"),
  saveOdooSettings: (payload) => request("/api/admin/odoo-settings", { method: "PUT", body: JSON.stringify(payload) }),
  getAutomationSettings: () => request("/api/admin/automation-settings"),
  saveAutomationSettings: (payload) => request("/api/admin/automation-settings", { method: "PUT", body: JSON.stringify(payload) }),
  testOdooSettings: () => request("/api/admin/odoo-settings/test", { method: "POST" }),

  // collection offers (عرض التحصيل)
  createCollectionOffer: (payload) => request("/api/admin/collection-offers", { method: "POST", body: JSON.stringify(payload) }),
  listCollectionOffers: () => request("/api/admin/collection-offers"),
  getCollectionOffer: (id) => request(`/api/admin/collection-offers/${id}`),
  updateCollectionOffer: (id, payload) => request(`/api/admin/collection-offers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setCollectionOfferParticipants: (id, participant_usernames) =>
    request(`/api/admin/collection-offers/${id}/participants`, { method: "PUT", body: JSON.stringify({ participant_usernames }) }),
  listCollectionOfferNominations: (id) => request(`/api/admin/collection-offers/${id}/nominations`),
  decideCollectionOfferNomination: (offerId, nominationId, payload) =>
    request(`/api/admin/collection-offers/${offerId}/nominations/${nominationId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  collectionOfferNominationWhatsappLink: (offerId, nominationId) =>
    request(`/api/admin/collection-offers/${offerId}/nominations/${nominationId}/whatsapp-link`),
  printCollectionOfferNominations: (id) => requestBlob(`/api/admin/collection-offers/${id}/nominations/pdf`),
  myCollectionOffers: () => request("/api/collection-offers/mine"),
  collectionOfferCustomers: (offerId, params = {}) => {
    const qs = buildQueryString(params);
    return request(`/api/collection-offers/${offerId}/customers${qs ? `?${qs}` : ""}`);
  },
  nominateForCollectionOffer: (offerId, partner_id) =>
    request(`/api/collection-offers/${offerId}/nominate`, { method: "POST", body: JSON.stringify({ partner_id }) }),
};
