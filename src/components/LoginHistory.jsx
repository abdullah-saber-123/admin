import { useEffect, useState } from "react";
import { History, Users2, LogIn, Search } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDateTime } from "../dateUtils.js";
import Avatar from "./Avatar.jsx";

// Very lightweight "what device/browser was this" reading from the raw
// User-Agent string - not exhaustive, just enough to show something
// friendlier than the full raw string in the table.
function readDevice(ua) {
  if (!ua) return "—";
  let os = "";
  if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os/i.test(ua)) os = "Mac";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua)) browser = "Safari";

  return [browser, os].filter(Boolean).join(" · ") || "—";
}

export default function LoginHistory() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.loginHistory().then(setData).catch((e) => setError(e.message));
  }, []);

  const visibleLog = (data?.log || []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.username.toLowerCase().includes(q);
  });

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><History size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("loginHistoryTitle")}</h2>
        <p className="panel-sub">{t("loginHistoryHint")}</p>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && data.summary.length === 0 && (
          <div className="empty-state">{t("noLoginHistory")}</div>
        )}

        {data && data.summary.length > 0 && (
          <>
            <h3 className="insights-chart-title" style={{ marginBottom: 10 }}>
              <Users2 size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              {t("loginsPerUser")}
            </h3>
            <div className="login-summary-grid">
              {data.summary.map((s) => (
                <div key={s.username} className="login-summary-card">
                  <Avatar name={s.username} />
                  <div className="login-summary-card-text">
                    <div className="login-summary-card-name">
                      {s.username}
                      <span className={`role-tag ${s.role}`} style={{ marginInlineStart: 6 }}>
                        {s.role === "admin" ? t("roleAdmin") : t("roleStaff")}
                      </span>
                    </div>
                    <div className="login-summary-card-sub">
                      {t("lastLogin")}: {fmtDateTime(s.last_login)}
                    </div>
                  </div>
                  <div className="login-summary-card-count">
                    <div className="login-summary-card-count-num">{s.count}</div>
                    <div className="login-summary-card-count-label">{t("logins")}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, margin: "22px 0 14px" }}>
              <div className="search-bar" style={{ maxWidth: 260 }}>
                <Search size={14} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchUsernamePlaceholder")} />
              </div>
            </div>

            {visibleLog.length === 0 ? (
              <div className="empty-state">{t("noMatch")}</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("username")}</th>
                      <th>{t("role")}</th>
                      <th>{t("loginTime")}</th>
                      <th>{t("device")}</th>
                      <th>{t("ipAddress")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLog.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="cust-cell">
                            <LogIn size={13} style={{ color: "var(--ok)" }} />
                            <span className="cust-name">{r.username}</span>
                          </div>
                        </td>
                        <td><span className={`role-tag ${r.role}`}>{r.role === "admin" ? t("roleAdmin") : t("roleStaff")}</span></td>
                        <td>{fmtDateTime(r.logged_in_at)}</td>
                        <td style={{ color: "var(--text-dim)" }}>{readDevice(r.user_agent)}</td>
                        <td style={{ color: "var(--text-faint)", fontSize: 12 }}><bdi dir="ltr">{r.ip_address || "—"}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
