import { useState } from "react";
import { Lock, User as UserIcon } from "lucide-react";
import { api, setSession } from "../api";
import { useLang } from "../i18n.jsx";
import swagLogo from "../assets/swag-mark.png";

export default function Login({ onLoggedIn }) {
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      setSession(res.token, res.role, res.username, res.permissions);
      onLoggedIn(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo login-logo-img">
          <img src={swagLogo} alt="SWAG" />
        </div>
        <h1>{t("loginTitle")}</h1>
        <p className="login-sub">{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit}>
          <div className="input-icon">
            <UserIcon size={16} />
            <input
              placeholder={t("username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="input-icon">
            <Lock size={16} />
            <input
              type="password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="error-state">{error}</div>}

          <button className="btn-primary full-width" type="submit" disabled={loading}>
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
