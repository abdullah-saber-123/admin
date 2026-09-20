import { useEffect, useState, useCallback, useRef, Suspense, lazy } from "react";
import { RefreshCw, CalendarClock, AlertOctagon, X, BellRing } from "lucide-react";
import { api, getSession, clearSession, onSessionExpired } from "./api";
import { useToast } from "./toast.jsx";
import { useLang } from "./i18n.jsx";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import KpiCards from "./components/KpiCards.jsx";
import CustomerTable from "./components/CustomerTable.jsx";
import CustomerDetail from "./components/CustomerDetail.jsx";
import CallOverlay from "./components/CallOverlay.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import AnnouncementOverlay from "./components/AnnouncementOverlay.jsx";
import PaymentCelebration from "./components/PaymentCelebration.jsx";
import AlertToasts from "./components/AlertToasts.jsx";
import usePushNotifications from "./hooks/usePushNotifications.js";
import ProfileModal from "./components/ProfileModal.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import GlobalSearch from "./components/GlobalSearch.jsx";

// Everything below is a page that's only visited occasionally - loading it
// only when the person actually navigates there (instead of upfront on every
// login) keeps the initial bundle small, which is what most affects how fast
// the app first feels to open.
const UsersPanel = lazy(() => import("./components/UsersPanel.jsx"));
const SettingsPanel = lazy(() => import("./components/SettingsPanel.jsx"));
const TeamsSettingsPanel = lazy(() => import("./components/TeamsSettingsPanel.jsx"));
const CollectorReport = lazy(() => import("./components/CollectorReport.jsx"));
const CollectionsReport = lazy(() => import("./components/CollectionsReport.jsx"));
const LoginHistory = lazy(() => import("./components/LoginHistory.jsx"));
const CustomerShares = lazy(() => import("./components/CustomerShares.jsx"));
const Trends = lazy(() => import("./components/Trends.jsx"));
const DueTodayReport = lazy(() => import("./components/DueTodayReport.jsx"));
const FollowupLogReport = lazy(() => import("./components/FollowupLogReport.jsx"));
const VisitsReport = lazy(() => import("./components/VisitsReport.jsx"));
const RetargetingReport = lazy(() => import("./components/RetargetingReport.jsx"));
const ReconciliationsReport = lazy(() => import("./components/ReconciliationsReport.jsx"));
const MyDay = lazy(() => import("./components/MyDay.jsx"));
const PaymentPlansReport = lazy(() => import("./components/PaymentPlansReport.jsx"));
const AnnouncementHistory = lazy(() => import("./components/AnnouncementHistory.jsx"));
const PerformanceReport = lazy(() => import("./components/PerformanceReport.jsx"));
const DailyActivityReport = lazy(() => import("./components/DailyActivityReport.jsx"));
const CollectorActivityExplorer = lazy(() => import("./components/CollectorActivityExplorer.jsx"));
const CostOfDebtReport = lazy(() => import("./components/CostOfDebtReport.jsx"));
const DebtWriteOffsReport = lazy(() => import("./components/DebtWriteOffsReport.jsx"));
const CreditNominationReport = lazy(() => import("./components/CreditNominationReport.jsx"));
const CollectionOffers = lazy(() => import("./components/CollectionOffers.jsx"));
const PaymentProofsReport = lazy(() => import("./components/PaymentProofsReport.jsx"));
const PortalManagementReport = lazy(() => import("./components/PortalManagementReport.jsx"));
const RemindersOverview = lazy(() => import("./components/RemindersOverview.jsx"));
const CustomerScoreReport = lazy(() => import("./components/CustomerScoreReport.jsx"));
const CustomerAnalytics = lazy(() => import("./components/CustomerAnalytics.jsx"));
const BrokenPromisesReport = lazy(() => import("./components/BrokenPromisesReport.jsx"));
const StaffChat = lazy(() => import("./components/StaffChat.jsx"));
const InvoicesReport = lazy(() => import("./components/InvoicesReport.jsx"));
const ChartsRow = lazy(() => import("./components/ChartsRow.jsx"));

import { parseServerDate } from "./dateUtils.js";

function timeAgo(iso) {
  if (!iso) return "never";
  const diffMin = Math.round((Date.now() - parseServerDate(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

export default function App() {
  const { t, dir } = useLang();
  const { showToast } = useToast();
  const [session, setSessionState] = useState(getSession());
  const [view, setView] = useState(() => {
    const urlView = new URLSearchParams(window.location.search).get("view");
    return urlView || localStorage.getItem("collect_view") || "dashboard";
  });
  const [initialAnalyticsPartnerId] = useState(() => {
    const c = new URLSearchParams(window.location.search).get("customer");
    // Consume the deep-link params once, then strip them from the URL - so
    // navigating elsewhere afterward and refreshing lands on wherever the
    // person actually is (view state / localStorage), not back on this
    // one-time link every time.
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    return c ? Number(c) : null;
  });
  const [kpis, setKpis] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [bucket, setBucket] = useState(null);
  const callOverlayRef = useRef(null);
  const [followupLogDateFilter, setFollowupLogDateFilter] = useState(null);
  const [cityFilter, setCityFilter] = useState(null);
  const [collectorFilter, setCollectorFilter] = useState(null);
  const [ageBucketFilter, setAgeBucketFilter] = useState(null);
  const [followupStatusFilter, setFollowupStatusFilter] = useState(null);
  const [profileModal, setProfileModal] = useState(null); // { mode: "self" | "user" | "collector", userId?, collectorName? }
  const [myProfile, setMyProfile] = useState(null); // own full_name/avatar_url - drives the sidebar chip
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [hideNegativeBalance, setHideNegativeBalance] = useState(false);
  const [collectorsList, setCollectorsList] = useState([]);
  const push = usePushNotifications();
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => localStorage.getItem("collect_push_banner_dismissed") === "1");

  const showPushBanner = push.supported && push.permission === "default" && !push.subscribed && !pushBannerDismissed;

  const dismissPushBanner = () => {
    localStorage.setItem("collect_push_banner_dismissed", "1");
    setPushBannerDismissed(true);
  };

  const handleEnablePush = async () => {
    const ok = await push.subscribe();
    if (ok) dismissPushBanner();
  };

  const loadKpis = useCallback(() => {
    const params = {};
    if (cityFilter) params.city = cityFilter;
    if (collectorFilter) params.collector = collectorFilter;
    if (hideZeroBalance) params.hide_zero_balance = true;
    if (hideNegativeBalance) params.hide_negative_balance = true;
    api.kpis(params).then(setKpis).catch(() => {});
  }, [cityFilter, collectorFilter, hideZeroBalance, hideNegativeBalance]);
  const loadSyncStatus = useCallback(() => {
    api.syncStatus().then(setSyncStatus).catch(() => {});
  }, []);

  useEffect(() => {
    api.collectors().then(setCollectorsList).catch(() => {});
  }, []);

  useEffect(() => {
    if (session) { loadKpis(); loadSyncStatus(); }
  }, [session, loadKpis, loadSyncStatus]);

  useEffect(() => {
    if (session) api.myProfile().then(setMyProfile).catch(() => {});
  }, [session]);

  // Remembers the last page visited so a refresh (or reopening the tab)
  // lands back where the person was instead of always resetting to the
  // dashboard - cleared on logout so the next login starts fresh.
  useEffect(() => {
    localStorage.setItem("collect_view", view);
  }, [view]);

  // If the token expires or is rejected mid-session (e.g. after hours idle in a tab),
  // drop straight back to the login screen instead of leaving stale data on display.
  useEffect(() => {
    onSessionExpired(() => setSessionState(null));
  }, []);

  // Background sync runs on the server every ~20 minutes on its own - this just quietly
  // pulls fresh numbers into the open tab every 45s so it stays current without the
  // person ever having to notice or do anything. Existing data stays on screen while
  // the new numbers load in, so nothing flashes or resets.
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      loadKpis();
      loadSyncStatus();
      setRefreshSignal((s) => s + 1);
    }, 45000);
    return () => clearInterval(interval);
  }, [session, loadKpis, loadSyncStatus]);

  if (!session) {
    return <Login onLoggedIn={(res) => setSessionState({ token: res.token, role: res.role, username: res.username, permissions: res.permissions })} />;
  }

  const handleLogout = () => { clearSession(); localStorage.removeItem("collect_view"); setSessionState(null); };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      loadKpis();
      loadSyncStatus();
      setRefreshSignal((s) => s + 1);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} role={session.role} username={session.username} displayName={myProfile?.full_name} avatarUrl={myProfile?.avatar_url} permissions={session.permissions} isSupervisor={session.is_supervisor} onLogout={handleLogout} onOpenProfile={() => setProfileModal({ mode: "self" })} />

      <div className="main-col">
        <div className="topbar">
          <h1>
            {view === "dashboard" ? t("dashboard")
              : view === "users" ? t("users")
              : view === "reports" ? t("collectorReports")
              : view === "trends" ? t("trends")
              : view === "dueToday" ? t("dueTodayReportTitle")
              : view === "staffChat" ? t("staffChatTitle")
              : view === "invoices" ? t("invoicesReportTitle")
              : view === "followupLog" ? t("followupLogTitle")
              : view === "visits" ? t("visitsTitle")
              : view === "retargeting" ? t("retargetingTitle")
              : view === "reconciliations" ? t("reconciliationsTitle")
              : view === "myDay" ? t("myDayTitle")
              : view === "performanceReport" ? t("performanceReportTitle")
              : view === "dailyActivity" ? t("dailyActivityTitle")
              : view === "collectorActivityExplorer" ? t("collectorActivityExplorerTitle")
              : view === "paymentPlans" ? t("paymentPlansPageTitle")
              : view === "announcementHistory" ? t("announcementHistoryTitle")
              : view === "costOfDebt" ? t("costOfDebtTitle")
              : view === "debtWriteOffs" ? t("debtWriteOffsTitle")
              : view === "creditNomination" ? t("creditNominationTitle")
              : view === "paymentProofs" ? t("paymentProofsTitle")
              : view === "portalManagement" ? t("portalManagementTitle")
              : view === "reminders" ? t("remindersOverviewTitle")
              : view === "customerScore" ? t("customerScoreTitle")
              : view === "customerAnalytics" ? t("customerAnalyticsTitle")
              : view === "brokenPromises" ? t("brokenPromisesTitle")
              : view === "collectionsReport" ? t("collectionsReportTitle")
              : view === "collectionOffers" ? t("collectionOfferTitle")
              : view === "loginHistory" ? t("loginHistoryTitle")
              : view === "customerShares" ? t("customerSharesTitle")
              : view === "teamsSettings" ? t("teamsIntegrationTitle")
              : t("odooSettings")}
          </h1>
          <div className="topbar-right">
            <GlobalSearch onSelectCustomer={setSelectedId} onGoToDashboard={() => setView("dashboard")} />
            <NotificationBell
              kpis={kpis}
              syncStatus={syncStatus}
              isAdmin={session.role === "admin"}
              onGoToDashboard={() => setView("dashboard")}
              onSelectBucket={(b) => { setView("dashboard"); setBucket(b); }}
              onSelectCustomer={setSelectedId}
            />
            {view === "dashboard" && (
              <div className="sync-pill">
                <span>
                  {t("lastSynced")}: {syncStatus ? timeAgo(syncStatus.last_sync) : "…"}
                  {syncStatus?.status === "failed" ? " (last sync failed)" : ""}
                </span>
                {session.role === "admin" && (
                  <button className="btn-secondary sm" onClick={handleSync} disabled={syncing}>
                    <RefreshCw size={14} className={syncing ? "spin" : ""} style={{ verticalAlign: -2, marginRight: 5 }} />
                    {syncing ? t("syncing") : t("syncNow")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showPushBanner && (
          <div className="alert-banner info push-banner">
            <BellRing size={16} />
            {t("enablePushBannerText")}
            <span className="alert-banner-action" onClick={handleEnablePush}>{t("enable")}</span>
            <button className="push-banner-dismiss" onClick={dismissPushBanner} title={t("cancel")}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className="content" key={view}>
          {view === "dashboard" && (
            <>
              {syncStatus?.consecutive_failures >= 2 && session.role === "admin" && (
                <div className="alert-banner danger">
                  <AlertOctagon size={16} />
                  {t("syncFailingBanner").replace("{n}", syncStatus.consecutive_failures)}
                  {syncStatus.error_message && (
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{syncStatus.error_message}</pre>
                  )}
                </div>
              )}
              {kpis?.followup_today_count > 0 && (
                <div className="alert-banner info" onClick={() => setBucket("followup_today")}>
                  <CalendarClock size={16} />
                  {kpis.followup_today_count} {t("followupsTodayBanner")}
                  <span className="alert-banner-action">{t("viewList")}</span>
                </div>
              )}
              <div className="dashboard-collector-filter">
                <label>{t("collectorField")}</label>
                <select value={collectorFilter || ""} onChange={(e) => setCollectorFilter(e.target.value || null)}>
                  <option value="">{t("allStatus")}</option>
                  {collectorsList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {collectorFilter && (
                  <button className="filter-chip" onClick={() => setCollectorFilter(null)}>
                    {collectorFilter} <X size={11} />
                  </button>
                )}
              </div>
              <KpiCards
                kpis={kpis}
                onCardClick={(b) => {
                  if (b === "followups_today_log") {
                    setFollowupLogDateFilter(new Date().toISOString().slice(0, 10));
                    setView("followupLog");
                    return;
                  }
                  setBucket(b === bucket ? null : b);
                }}
                activeBucket={bucket}
              />
              <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}>
                <ChartsRow
                  kpis={kpis}
                  statusCounts={kpis?.status_counts}
                  followupStatusCounts={kpis?.followup_status_counts}
                  activeCity={cityFilter}
                  onCityClick={(c) => setCityFilter(c === cityFilter ? null : c)}
                  activeAgeBucket={ageBucketFilter}
                  onAgeBucketClick={(b) => setAgeBucketFilter(b === ageBucketFilter ? null : b)}
                  activeFollowupStatus={followupStatusFilter}
                  onFollowupStatusClick={setFollowupStatusFilter}
                />
              </Suspense>
              <CustomerTable
                onSelect={setSelectedId}
                bucket={bucket}
                onClearBucket={() => setBucket(null)}
                city={cityFilter}
                onClearCity={() => setCityFilter(null)}
                onCityChange={setCityFilter}
                ageBucket={ageBucketFilter}
                onClearAgeBucket={() => setAgeBucketFilter(null)}
                followupStatus={followupStatusFilter}
                onClearFollowupStatus={() => setFollowupStatusFilter(null)}
                collector={collectorFilter}
                onClearCollector={() => setCollectorFilter(null)}
                onCollectorChange={setCollectorFilter}
                hideZeroBalance={hideZeroBalance}
                onToggleHideZeroBalance={setHideZeroBalance}
                hideNegativeBalance={hideNegativeBalance}
                onToggleHideNegativeBalance={setHideNegativeBalance}
                refreshSignal={refreshSignal}
                role={session.role}
                permissions={session.permissions}
                onOpenCollectorProfile={(name) => setProfileModal({ mode: "collector", collectorName: name })}
              />
            </>
          )}
          {view === "users" && session.role === "admin" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}>
              <UsersPanel onOpenUserProfile={(id) => setProfileModal({ mode: "user", userId: id })} />
            </Suspense>
          )}
          {view === "reports" && (session.role === "admin" || (session.permissions || "").includes("reports")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CollectorReport onOpenProfile={(id) => setProfileModal({ mode: "user", userId: id })} /></Suspense>
          )}
          {view === "collectionsReport" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CollectionsReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "loginHistory" && session.role === "admin" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><LoginHistory /></Suspense>
          )}
          {view === "customerShares" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CustomerShares /></Suspense>
          )}
          {view === "trends" && (session.role === "admin" || (session.permissions || "").includes("trends")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><Trends /></Suspense>
          )}
          {view === "dueToday" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><DueTodayReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "staffChat" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}>
              <StaffChat role={session.role} username={session.username} callOverlayRef={callOverlayRef} onOpenAnnouncementHistory={() => setView("announcementHistory")} />
            </Suspense>
          )}
          {view === "invoices" && (session.role === "admin" || (session.permissions || "").includes("invoices")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><InvoicesReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "followupLog" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}>
              <FollowupLogReport
                onSelectCustomer={setSelectedId}
                initialDateFilter={followupLogDateFilter}
                onConsumeInitialFilter={() => setFollowupLogDateFilter(null)}
              />
            </Suspense>
          )}
          {view === "visits" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><VisitsReport onSelectCustomer={setSelectedId} role={session.role} username={session.username} /></Suspense>
          )}
          {view === "retargeting" && (session.role === "admin" || (session.permissions || "").includes("customerRetargeting")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><RetargetingReport onSelectCustomer={setSelectedId} role={session.role} username={session.username} /></Suspense>
          )}
          {view === "reconciliations" && (session.role === "admin" || (session.permissions || "").includes("reconciliations")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><ReconciliationsReport onSelectCustomer={setSelectedId} role={session.role} username={session.username} /></Suspense>
          )}
          {view === "myDay" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><MyDay onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "performanceReport" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><PerformanceReport /></Suspense>
          )}
          {view === "dailyActivity" && (session.role === "admin" || session.is_supervisor) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><DailyActivityReport isSupervisor={session.role !== "admin"} /></Suspense>
          )}
          {view === "collectorActivityExplorer" && session.role === "admin" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CollectorActivityExplorer /></Suspense>
          )}
          {view === "paymentPlans" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><PaymentPlansReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "announcementHistory" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><AnnouncementHistory onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "costOfDebt" && (session.role === "admin" || (session.permissions || "").includes("costOfDebt")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CostOfDebtReport /></Suspense>
          )}
          {view === "debtWriteOffs" && (session.role === "admin" || (session.permissions || "").includes("debtWriteOffs")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><DebtWriteOffsReport onSelectCustomer={setSelectedId} role={session.role} /></Suspense>
          )}
          {view === "creditNomination" && (session.role === "admin" || (session.permissions || "").includes("creditNomination")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CreditNominationReport onSelectCustomer={setSelectedId} role={session.role} /></Suspense>
          )}
          {view === "collectionOffers" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CollectionOffers role={session.role} username={session.username} /></Suspense>
          )}
          {view === "paymentProofs" && (session.role === "admin" || (session.permissions || "").includes("paymentProofs")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><PaymentProofsReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "portalManagement" && (session.role === "admin" || (session.permissions || "").includes("portalManagement")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><PortalManagementReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "reminders" && (session.role === "admin" || (session.permissions || "").includes("reminders")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><RemindersOverview onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "customerScore" && (session.role === "admin" || (session.permissions || "").includes("customerScore")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CustomerScoreReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "customerAnalytics" && (
            session.role === "admin"
            || (session.permissions || "").includes("customerAnalytics")
            || (initialAnalyticsPartnerId && (session.permissions || "").includes("customerOwnAnalysis"))
          ) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><CustomerAnalytics onSelectCustomer={setSelectedId} initialPartnerId={initialAnalyticsPartnerId} /></Suspense>
          )}
          {view === "brokenPromises" && (session.role === "admin" || (session.permissions || "").includes("brokenPromises")) && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><BrokenPromisesReport onSelectCustomer={setSelectedId} /></Suspense>
          )}
          {view === "settings" && session.role === "admin" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}>
              <SettingsPanel onSaved={() => { loadKpis(); loadSyncStatus(); }} />
            </Suspense>
          )}
          {view === "teamsSettings" && session.role === "admin" && (
            <Suspense fallback={<div className="loading-state">{t("loadingDots")}</div>}><TeamsSettingsPanel /></Suspense>
          )}
        </div>
      </div>

      {selectedId && (
        <CustomerDetail
          partnerId={selectedId}
          role={session.role}
          permissions={session.permissions}
          onClose={() => setSelectedId(null)}
          onSaved={() => setRefreshSignal((s) => s + 1)}
        />
      )}

      <CallOverlay ref={callOverlayRef} username={session.username} />
      <ChatWidget callOverlayRef={callOverlayRef} />
      <AnnouncementOverlay />
      <PaymentCelebration />
      <AlertToasts
        role={session.role}
        onViewDueToday={() => setView("dueToday")}
        onViewNeglected={() => { setBucket("neglected_contact"); setView("dashboard"); }}
        onReviewCollector={(name) => name && setProfileModal({ mode: "collector", collectorName: name })}
        onViewReconciliations={() => setView("reconciliations")}
      />

      {profileModal && (
        <ProfileModal
          mode={profileModal.mode}
          userId={profileModal.userId}
          collectorName={profileModal.collectorName}
          onClose={() => setProfileModal(null)}
          callOverlayRef={callOverlayRef}
          onProfileUpdated={(updated) => profileModal.mode === "self" && setMyProfile(updated)}
        />
      )}
    </div>
  );
}
