import { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ReportIssueButton from './components/ReportIssueButton';
import AdminScreen from './screens/AdminScreen';
import SideNav from './components/SideNav';
import ConnectionBanner from './components/ConnectionBanner';
import RequireAuth from './auth/RequireAuth';
import { strings } from './strings';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import WarbandListScreen from './screens/WarbandListScreen';
import NewWarbandScreen from './screens/NewWarbandScreen';
import RosterScreen from './screens/RosterScreen';
import ModelDetailScreen from './screens/ModelDetailScreen';
import HenchmenDetailScreen from './screens/HenchmenDetailScreen';
import AddHeroScreen from './screens/AddHeroScreen';
import AddHenchmenScreen from './screens/AddHenchmenScreen';
import AddHiredSwordScreen from './screens/AddHiredSwordScreen';
import SettingsScreen from './screens/SettingsScreen';
import DesignSandboxScreen from './screens/DesignSandboxScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import WarbandPickerScreen from './screens/WarbandPickerScreen';
import PreBattleScreen from './screens/PreBattleScreen';
import DuringBattleScreen from './screens/DuringBattleScreen';
import PostBattleWizard from './screens/postBattle/PostBattleWizard';
import TradingPostScreen from './screens/TradingPostScreen';
import CampaignScreen from './screens/CampaignScreen';
import MyCampaignsScreen from './screens/MyCampaignsScreen';
import SharedWarbandScreen from './screens/SharedWarbandScreen';
import GalleryScreen from './screens/GalleryScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import RulesScreen from './screens/RulesScreen';
import RuleDetailScreen from './screens/RuleDetailScreen';

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
          <Routes>
            {/* --- Public: static reference content --- */}
            <Route path="/" element={<HomeScreen />} />
            <Route path="/rules" element={<RulesScreen />} />
            <Route path="/rules/:ruleId" element={<RuleDetailScreen />} />
            <Route path="/profile" element={<SettingsScreen />} />
            {/* The tab was renamed Settings -> Profile. Redirects rather
                than a bare rename, so a bookmark or an old changelog link
                still lands somewhere. */}
            <Route path="/settings" element={<Navigate to="/profile" replace />} />
            <Route path="/settings/changelog" element={<Navigate to="/profile/changelog" replace />} />
            {/* Not linked from the nav. The gate is in the database —
                `issue_reports` and `admin_stats()` are admin-only, so a
                non-admin reaching this URL gets nothing to read. */}
            <Route path="/admin" element={guarded(<AdminScreen />)} />
            <Route path="/profile/changelog" element={<ChangelogScreen />} />
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
    </BrowserRouter>
  );
}
