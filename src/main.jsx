import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import CustomerPortalApp from "./CustomerPortalApp.jsx";
import { LanguageProvider } from "./i18n.jsx";
import { ToastProvider } from "./toast.jsx";
import "./index.css";

// The customer portal is a completely separate experience from the staff/admin
// app - reached at /portal, with its own login and session (never mixed with
// the staff app's session/localStorage keys).
const isPortal = window.location.pathname.startsWith("/portal");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <ToastProvider>
        {isPortal ? <CustomerPortalApp /> : <App />}
      </ToastProvider>
    </LanguageProvider>
  </React.StrictMode>
);
