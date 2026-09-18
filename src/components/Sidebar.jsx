import { useState } from "react";
import Avatar from "./Avatar.jsx";
import {
  LayoutDashboard, Users, Settings, LogOut, BarChart3, TrendingUp, Languages,
  CalendarClock, ClipboardList, Menu, X, ChevronLeft, ChevronRight, ChevronDown,
  CircleDollarSign, CreditCard, Receipt, Smartphone, CalendarRange, BellRing,
  Gauge, FileText, HeartCrack, MessageSquare, UserCircle, Moon, Sun, Wallet, History, Share2, Activity, Megaphone,
} from "lucide-react";
import { useLang } from "../i18n.jsx";
import swagLogo from "../assets/swag-mark.png";
import useBodyScrollLock from "../hooks/useBodyScrollLock.js";

export default function Sidebar({ view, setView, role, username, displayName, avatarUrl, permissions, onLogout, onOpenProfile }) {
  const { t, lang, setLanguage, theme, toggleTheme } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("collect_sidebar_collapsed") === "1");
  const [openCategories, setOpenCategories] = useState(() => {
    try {
      const saved = localStorage.getItem("collect_sidebar_open_categories");
      return saved ? JSON.parse(saved) : { overview: true, collections: true, finance: true, customers: true, team: true, system: true };
    } catch {
      return { overview: true, collections: true, finance: true, customers: true, team: true, system: true };
    }
  });

  // Without this, opening the mobile drawer doesn't stop the page underneath
  // from scrolling too - a touch-drag meant to scroll the nav list bleeds
  // through and scrolls the background content instead (iOS Safari especially).
  useBodyScrollLock(mobileOpen);

  const perms = (permissions || "").split(",").map((p) => p.trim());
  const canSeeReports = role === "admin" || perms.includes("reports");
  const canSeeTrends = role === "admin" || perms.includes("trends");
  const canSeePortalManagement = role === "admin" || perms.includes("portalManagement");
  const canSeeMonthlyReport = role === "admin" || perms.includes("monthlyReport");
  const canSeeReminders = role === "admin" || perms.includes("reminders");
  const canSeeCustomerScore = role === "admin" || perms.includes("customerScore");
  const canSeeCustomerAnalytics = role === "admin" || perms.includes("customerAnalytics");
  const canSeeInvoices = role === "admin" || perms.includes("invoices");
  const canSeePaymentProofs = role === "admin" || perms.includes("paymentProofs");
  const canSeeCreditNomination = role === "admin" || perms.includes("creditNomination");
  const canSeeCostOfDebt = role === "admin" || perms.includes("costOfDebt");
  const canSeeBrokenPromises = role === "admin" || perms.includes("brokenPromises");

  const go = (v) => {
    setView(v);
    setMobileOpen(false);
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("collect_sidebar_collapsed", !c ? "1" : "0");
      return !c;
    });
  };

  const toggleCategory = (key) => {
    setOpenCategories((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("collect_sidebar_open_categories", JSON.stringify(next));
      return next;
    });
  };

  // Grouped into logical categories so a long flat list becomes scannable -
  // each category is a collapsible section (collapsed sidebar mode shows
  // every icon flat instead, since there's no room for category headers).
  const categories = [
    {
      key: "collections",
      label: t("categoryCollections"),
      items: [
        { view: "myDay", icon: Sun, label: t("myDayTitle"), visible: true, color: "#FF8A00" },
        { view: "performanceReport", icon: Gauge, label: t("performanceReportTitle"), visible: true, color: "#5750f1" },
        { view: "dailyActivity", icon: Activity, label: t("dailyActivityTitle"), visible: role === "admin", color: "#2C8397" },
        { view: "collectorActivityExplorer", icon: UserCircle, label: t("collectorActivityExplorerTitle"), visible: role === "admin", color: "#5750f1" },
        { view: "paymentPlans", icon: CalendarClock, label: t("paymentPlansPageTitle"), visible: true, color: "#8E6CEF" },
        { view: "dueToday", icon: CalendarClock, label: t("dueTodayReportTitle"), visible: true, color: "#2C8397" },
        { view: "followupLog", icon: ClipboardList, label: t("followupLogTitle"), visible: true, color: "#F4A460" },
        { view: "invoices", icon: FileText, label: t("invoicesReportTitle"), visible: canSeeInvoices, color: "#F06050" },
        { view: "reminders", icon: BellRing, label: t("remindersOverviewTitle"), visible: canSeeReminders, color: "#D6145F" },
        { view: "brokenPromises", icon: HeartCrack, label: t("brokenPromisesTitle"), visible: canSeeBrokenPromises, color: "#EB7E7F" },
      ],
    },
    {
      key: "finance",
      label: t("categoryFinance"),
      items: [
        { view: "costOfDebt", icon: CircleDollarSign, label: t("costOfDebtTitle"), visible: canSeeCostOfDebt, color: "#30C381" },
        { view: "creditNomination", icon: CreditCard, label: t("creditNominationTitle"), visible: canSeeCreditNomination, color: "#9365B8" },
        { view: "monthlyReport", icon: CalendarRange, label: t("monthlyReportTitle"), visible: canSeeMonthlyReport, color: "#6CC1ED" },
        { view: "paymentProofs", icon: Receipt, label: t("paymentProofsTitle"), visible: canSeePaymentProofs, color: "#814968" },
        { view: "collectionsReport", icon: Wallet, label: t("collectionsReportTitle"), visible: true, color: "#30C381" },
        { view: "collectionOffers", icon: Megaphone, label: t("collectionOfferTitle"), visible: true, color: "#D6145F" },
      ],
    },
    {
      key: "customers",
      label: t("categoryCustomers"),
      items: [
        { view: "portalManagement", icon: Smartphone, label: t("portalManagementTitle"), visible: canSeePortalManagement, color: "#475577" },
        { view: "customerScore", icon: Gauge, label: t("customerScoreTitle"), visible: canSeeCustomerScore, color: "#F4A460" },
        { view: "customerAnalytics", icon: BarChart3, label: t("customerAnalyticsTitle"), visible: canSeeCustomerAnalytics, color: "#5750f1" },
        { view: "customerShares", icon: Share2, label: t("customerSharesTitle"), visible: true, color: "#9365B8" },
      ],
    },
    {
      key: "team",
      label: t("categoryTeam"),
      items: [
        { view: "staffChat", icon: MessageSquare, label: t("staffChatTitle"), visible: true, color: "#D6145F" },
        { view: "announcementHistory", icon: History, label: t("announcementHistoryTitle"), visible: true, color: "#F4A460" },
        { view: "users", icon: Users, label: t("users"), visible: role === "admin", color: "#9365B8" },
        { view: "loginHistory", icon: History, label: t("loginHistoryTitle"), visible: role === "admin", color: "#6CC1ED" },
        { view: "reports", icon: BarChart3, label: t("collectorReports"), visible: canSeeReports, color: "#30C381" },
        { view: "trends", icon: TrendingUp, label: t("trends"), visible: canSeeTrends, color: "#2C8397" },
      ],
    },
    {
      key: "system",
      label: t("categorySystem"),
      items: [
        { view: "settings", icon: Settings, label: t("odooSettings"), visible: role === "admin", color: "#475577" },
        { view: "teamsSettings", icon: MessageSquare, label: t("teamsIntegrationTitle"), visible: role === "admin", color: "#5059C9" },
      ],
    },
  ];

  return (
    <>
      {/* Mobile-only top bar: hamburger + logo, always visible, opens the full drawer */}
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
          <Menu size={20} />
        </button>
        <img src={swagLogo} alt="SWAG" className="sidebar-logo-img" />
        <span className="mobile-topbar-title">{t("appName")}</span>
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        {!collapsed && <div className="sidebar-test-banner">{t("testVersionBanner")}</div>}
        <div className="sidebar-logo">
          <img src={swagLogo} alt="SWAG" className="sidebar-logo-img" />
          {!collapsed && <span>{t("appName")}</span>}
          {!collapsed && (
            <div className="sidebar-header-actions">
              <button
                className="lang-toggle icon-only"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                className="lang-toggle"
                onClick={() => setLanguage(lang === "en" ? "ar" : "en")}
                title="Switch language"
              >
                <Languages size={13} />
                {lang === "en" ? "AR" : "EN"}
              </button>
            </div>
          )}
          <button className="sidebar-close-btn" onClick={() => setMobileOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${view === "dashboard" ? "active" : ""}`}
            onClick={() => go("dashboard")}
            title={collapsed ? t("dashboard") : undefined}
          >
            <span className="nav-icon-chip" style={{ "--icon-color": "#F7CD1F" }}>
              <LayoutDashboard size={15} />
            </span>
            {!collapsed && t("dashboard")}
          </button>

          {collapsed ? (
            // Collapsed (icon-only) mode: no room for category headers, so every
            // item is shown flat, same as before.
            categories.flatMap((cat) => cat.items.filter((i) => i.visible)).map((item) => (
              <button
                key={item.view}
                className={`nav-item ${view === item.view ? "active" : ""}`}
                onClick={() => go(item.view)}
                title={item.label}
              >
                <span className="nav-icon-chip" style={{ "--icon-color": item.color }}>
                  <item.icon size={15} />
                </span>
              </button>
            ))
          ) : (
            categories.map((cat) => {
              const visibleItems = cat.items.filter((i) => i.visible);
              if (visibleItems.length === 0) return null;
              const isOpen = openCategories[cat.key] !== false;
              return (
                <div key={cat.key} className="sidebar-category">
                  <button className="sidebar-category-header" onClick={() => toggleCategory(cat.key)}>
                    <span>{cat.label}</span>
                    <ChevronDown size={14} className={`sidebar-category-chevron ${isOpen ? "open" : ""}`} />
                  </button>
                  {isOpen && visibleItems.map((item) => (
                    <button
                      key={item.view}
                      className={`nav-item ${view === item.view ? "active" : ""}`}
                      onClick={() => go(item.view)}
                    >
                      <span className="nav-icon-chip" style={{ "--icon-color": item.color }}>
                        <item.icon size={15} />
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip-wrap">
            <button className="user-chip" onClick={() => setProfileMenuOpen((v) => !v)}>
              <Avatar name={displayName || username} src={avatarUrl} />
              {!collapsed && (
                <>
                  <div>
                    <div className="uname">{displayName || username}</div>
                    <div className="urole">{role}</div>
                  </div>
                  <ChevronDown size={13} className={`user-chip-chevron ${profileMenuOpen ? "open" : ""}`} />
                </>
              )}
            </button>
            {profileMenuOpen && (
              <>
                <div className="columns-menu-backdrop" onClick={() => setProfileMenuOpen(false)} />
                <div className="user-chip-dropdown">
                  <button onClick={() => { setProfileMenuOpen(false); setMobileOpen(false); onOpenProfile?.(); }}>
                    <UserCircle size={15} />
                    {t("myProfile")}
                  </button>
                  <button className="danger" onClick={() => { setProfileMenuOpen(false); setMobileOpen(false); setShowLogoutConfirm(true); }}>
                    <LogOut size={15} />
                    {t("logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Rendered as a sibling, not a child, of <aside> - the sidebar itself
          uses overflow:hidden + width:0 when collapsed, which would clip
          this button into invisibility (even as position:fixed) if it were
          nested inside. Kept outside so it's always reachable to expand
          the sidebar again. */}
      <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed ? t("expandSidebar") : t("collapseSidebar")}>
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {showLogoutConfirm && (
        <div className="overlay modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <LogOut size={22} />
            </div>
            <h3>{t("logoutConfirmTitle")}</h3>
            <p>{t("logoutConfirmHint")}</p>
            <div className="confirm-modal-actions">
              <button onClick={() => setShowLogoutConfirm(false)}>{t("no")}</button>
              <button className="danger" onClick={onLogout}>{t("logoutConfirmYes")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
