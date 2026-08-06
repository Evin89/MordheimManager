import { ReactElement, Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ReportIssueButton from './components/ReportIssueButton';
import SideNav from './components/SideNav';
import ConnectionBanner from './components/ConnectionBanner';
import RequireAuth from './auth/RequireAuth';
import { strings } from './strings';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import WarbandListScreen from './screens/WarbandListScreen';
import RosterScreen from './screens/RosterScreen';
import SettingsScreen from './screens/SettingsScreen';

const AdminScreen = lazy(() => import('./screens/AdminScreen'));

const DesignSandboxScreen = lazy(() => import('./screens/DesignSandboxScreen'));

const ChangelogScreen = lazy(() => import('./screens/ChangelogScreen'));

const RulesScreen = lazy(() => import('./screens/RulesScreen'));

const RuleDetailScreen = lazy(() => import('./screens/RuleDetailScreen'));

const PostBattleWizard = lazy(() => import('./screens/postBattle/PostBattleWizard'));

const TradingPostScreen = lazy(() => import('./screens/TradingPostScreen'));

const PreBattleScreen = lazy(() => import('./screens/PreBattleScreen'));

const DuringBattleScreen = lazy(() => import('./screens/DuringBattleScreen'));

const GalleryScreen = lazy(() => import('./screens/GalleryScreen'));

const SharedWarbandScreen = lazy(() => import('./screens/SharedWarbandScreen'));

const CampaignScreen = lazy(() => import('./screens/CampaignScreen'));

const MyCampaignsScreen = lazy(() => import('./screens/MyCampaignsScreen'));

const ModelDetailScreen = lazy(() => import('./screens/ModelDetailScreen'));

const HenchmenDetailScreen = lazy(() => import('./screens/HenchmenDetailScreen'));

const AddHeroScreen = lazy(() => import('./screens/AddHeroScreen'));

const AddHenchmenScreen = lazy(() => import('./screens/AddHenchmenScreen'));

const AddHiredSwordScreen = lazy(() => import('./screens/AddHiredSwordScreen'));

const NewWarbandScreen = lazy(() => import('./screens/NewWarbandScreen'));

const WarbandPickerScreen = lazy(() => import('./screens/WarbandPickerScreen'));

const ForgotPasswordScreen = lazy(() => import('./screens/ForgotPasswordScreen'));

const ResetPasswordScreen = lazy(() => import('./screens/ResetPasswordScreen'));

/**
 * Shown while a route's chunk downloads.
 *
 * Deliberately the same wording RequireAuth uses while restoring a session, so
 * the two waits look like one thing to the user rather than two different
 * stalls. Most navigations never show it — the chunk is usually cached by the
 * time it's needed.
 */
function RouteFallback() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <p className="text-bone-300">{strings.common.loading}</p>
    </div>
  );
}

/** Wraps a route element in the auth gate, redirecting to /login when signed out. */
function guarded(element: ReactElement) {
  return <RequireAuth>{element}</RequireAuth>;
}

/**
 * The app shell: navigation plus the routed screen content.
 *
 * Reference content (Home, Rules, Skills, changelog) is public — it's static
 * game data that needs no account, and keeping it open means the rules are
 * usable at the table by anyone. Everything that reads or writes *your* data
 * (warbands, battles, trading, campaign, data export/import) sits behind
 * `guarded`, since those rows are owned by a user and RLS-scoped.
 */
function AppShell() {
  return (
    <div className="min-h-full md:flex md:items-start">
      <SideNav />
      <div className="flex-1 min-w-0 pb-[56px] md:pb-0">
        <ConnectionBanner />
        <div className="mx-auto w-full max-w-4xl">
          <Suspense fallback={<RouteFallback />}>
      <Routes>
            {/* --- Public: static reference content --- */}
            <Route path="/" element={<HomeScreen />} />
            <Route path="/rules" element={<RulesScreen />} />
            <Route path="/rules/:ruleId" element={<RuleDetailScreen />} />
            <Route path="/account" element={<SettingsScreen />} />
            {/* The tab was renamed Settings -> Profile. Redirects rather
                than a bare rename, so a bookmark or an old changelog link
                still lands somewhere. */}
            {/* Two renames deep now: Settings became Profile, Profile became
                Account. Both old paths still resolve, so links shared in
                the group chat and anyone's bookmarks keep working. */}
            <Route path="/settings" element={<Navigate to="/account" replace />} />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            <Route path="/settings/changelog" element={<Navigate to="/account/changelog" replace />} />
            <Route path="/profile/changelog" element={<Navigate to="/account/changelog" replace />} />
            {/* Not linked from the nav. The gate is in the database —
                `issue_reports` and `admin_stats()` are admin-only, so a
                non-admin reaching this URL gets nothing to read. */}
            <Route path="/admin" element={guarded(<AdminScreen />)} />
            <Route path="/account/changelog" element={<ChangelogScreen />} />
            {/* Warbands their owners chose to publish, plus the read-only roster
                behind each one. Public by design — an opted-in roster you can't
                show to someone without an account isn't really shared. The
                database enforces this independently (migration 0004). */}
            <Route path="/gallery" element={<GalleryScreen />} />
            <Route path="/rosters/:warbandId" element={<SharedWarbandScreen />} />

            {/* --- Requires an account: your warbands, battles and campaign --- */}
            <Route path="/warbands" element={guarded(<WarbandListScreen />)} />
            <Route path="/warbands/new" element={guarded(<NewWarbandScreen />)} />
            <Route path="/warbands/:warbandId" element={guarded(<RosterScreen />)} />
            <Route path="/warbands/:warbandId/add-hero" element={guarded(<AddHeroScreen />)} />
            <Route path="/warbands/:warbandId/add-henchmen" element={guarded(<AddHenchmenScreen />)} />
            <Route path="/warbands/:warbandId/add-hired-sword" element={guarded(<AddHiredSwordScreen />)} />
            <Route path="/warbands/:warbandId/hero/:modelId" element={guarded(<ModelDetailScreen kind="hero" />)} />
            <Route
              path="/warbands/:warbandId/hired-sword/:modelId"
              element={guarded(<ModelDetailScreen kind="hiredSword" />)}
            />
            <Route path="/warbands/:warbandId/henchmen/:groupId" element={guarded(<HenchmenDetailScreen />)} />
            <Route path="/warbands/:warbandId/pre-battle" element={guarded(<PreBattleScreen />)} />
            <Route path="/warbands/:warbandId/during-battle" element={guarded(<DuringBattleScreen />)} />
            <Route path="/warbands/:warbandId/post-battle" element={guarded(<PostBattleWizard />)} />
            <Route path="/warbands/:warbandId/trading" element={guarded(<TradingPostScreen />)} />
            <Route
              path="/post-battle"
              element={guarded(
                <WarbandPickerScreen
                  title={strings.battle.pickWarbandTitle}
                  prompt={strings.battle.pickWarbandPrompt}
                  emptyMessage={strings.battle.noWarbands}
                  destination={(id) => `/warbands/${id}/pre-battle`}
                />,
              )}
            />
            <Route
              path="/trading"
              element={guarded(
                <WarbandPickerScreen
                  title={strings.trading.pickWarbandTitle}
                  prompt={strings.trading.pickWarbandPrompt}
                  emptyMessage={strings.trading.noWarbands}
                  destination={(id) => `/warbands/${id}/trading`}
                />,
              )}
            />
            <Route path="/campaign" element={guarded(<CampaignScreen />)} />
            <Route path="/campaigns" element={guarded(<MyCampaignsScreen />)} />
            {/* Where standings used to link; kept so older in-app links still land. */}
            <Route path="/campaign/warbands/:warbandId" element={guarded(<SharedWarbandScreen />)} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </Suspense>
        </div>
        {/* Below the routed content on every screen, so "this page" means the
            page you're actually looking at. */}
        <ReportIssueButton />
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* Auth screens render outside the app shell — no nav on the sign-in flow. */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        {/* Design workbench for spec §5 — not linked from the nav. */}
        <Route path="/design" element={<DesignSandboxScreen />} />
        <Route path="*" element={<AppShell />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
