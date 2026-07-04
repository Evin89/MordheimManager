import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { strings } from './strings';
import { useAppStore } from './store/useAppStore';
import WarbandListScreen from './screens/WarbandListScreen';
import NewWarbandScreen from './screens/NewWarbandScreen';
import RosterScreen from './screens/RosterScreen';
import ModelDetailScreen from './screens/ModelDetailScreen';
import HenchmenDetailScreen from './screens/HenchmenDetailScreen';
import AddHeroScreen from './screens/AddHeroScreen';
import AddHenchmenScreen from './screens/AddHenchmenScreen';
import SettingsScreen from './screens/SettingsScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import PostBattlePickerScreen from './screens/PostBattlePickerScreen';
import PostBattleWizard from './screens/postBattle/PostBattleWizard';

export default function App() {
  const load = useAppStore((state) => state.load);
  const loaded = useAppStore((state) => state.loaded);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">Loading…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-full pb-[56px]">
        <Routes>
          <Route path="/" element={<Navigate to="/warbands" replace />} />
          <Route path="/warbands" element={<WarbandListScreen />} />
          <Route path="/warbands/new" element={<NewWarbandScreen />} />
          <Route path="/warbands/:warbandId" element={<RosterScreen />} />
          <Route path="/warbands/:warbandId/add-hero" element={<AddHeroScreen />} />
          <Route path="/warbands/:warbandId/add-henchmen" element={<AddHenchmenScreen />} />
          <Route path="/warbands/:warbandId/hero/:modelId" element={<ModelDetailScreen kind="hero" />} />
          <Route
            path="/warbands/:warbandId/hired-sword/:modelId"
            element={<ModelDetailScreen kind="hiredSword" />}
          />
          <Route path="/warbands/:warbandId/henchmen/:groupId" element={<HenchmenDetailScreen />} />
          <Route path="/warbands/:warbandId/post-battle" element={<PostBattleWizard />} />
          <Route path="/post-battle" element={<PostBattlePickerScreen />} />
          <Route path="/trading" element={<PlaceholderScreen title={strings.nav.trading} />} />
          <Route path="/campaign" element={<PlaceholderScreen title={strings.nav.campaign} />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/warbands" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
