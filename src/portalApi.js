const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "portal_token";
const NAME_KEY = "portal_customer_name";

export function getPortalSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { token, customerName: localStorage.getItem(NAME_KEY) };
}

export function setPortalSession(token, customerName) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, customerName || "");
}

export function clearPortalSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

async function request(path, options = {}) {
  const session = getPortalSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      const detail = JSON.parse(body).detail;
      msg = Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ") : detail || body;
    } catch { /* keep raw */ }
    if (res.status === 401) clearPortalSession();
    throw new Error(msg || `API error ${res.status}`);
  }
  return res.json();
}

export const portalApi = {
  login: (username, password) =>
    request("/api/portal/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/api/portal/me"),
  invoices: (page = 1) => request(`/api/portal/invoices?page=${page}&page_size=15`),
  changePassword: (current_password, new_password) =>
    request("/api/portal/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  uploadPaymentProof: (payload) =>
    request("/api/portal/payment-proofs", { method: "POST", body: JSON.stringify(payload) }),
  myPaymentProofs: () => request("/api/portal/payment-proofs"),
  getChat: () => request("/api/portal/chat"),
  sendChat: (message) => request("/api/portal/chat", { method: "POST", body: JSON.stringify({ message }) }),
};
