import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { strings } from './strings';
import { useAppStore } from './store/useAppStore';
import HomeScreen from './screens/HomeScreen';
import WarbandListScreen from './screens/WarbandListScreen';
import NewWarbandScreen from './screens/NewWarbandScreen';
import RosterScreen from './screens/RosterScreen';
import ModelDetailScreen from './screens/ModelDetailScreen';
import HenchmenDetailScreen from './screens/HenchmenDetailScreen';
import AddHeroScreen from './screens/AddHeroScreen';
import AddHenchmenScreen from './screens/AddHenchmenScreen';
import SettingsScreen from './screens/SettingsScreen';
import WarbandPickerScreen from './screens/WarbandPickerScreen';
import PreBattleScreen from './screens/PreBattleScreen';
import DuringBattleScreen from './screens/DuringBattleScreen';
import PostBattleWizard from './screens/postBattle/PostBattleWizard';
import TradingPostScreen from './screens/TradingPostScreen';
import CampaignScreen from './screens/CampaignScreen';
import RulesScreen from './screens/RulesScreen';
import RuleDetailScreen from './screens/RuleDetailScreen';

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
          <Route path="/" element={<HomeScreen />} />
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
          <Route path="/warbands/:warbandId/pre-battle" element={<PreBattleScreen />} />
          <Route path="/warbands/:warbandId/during-battle" element={<DuringBattleScreen />} />
          <Route path="/warbands/:warbandId/post-battle" element={<PostBattleWizard />} />
          <Route path="/warbands/:warbandId/trading" element={<TradingPostScreen />} />
          <Route
            path="/post-battle"
            element={
              <WarbandPickerScreen
                title={strings.battle.pickWarbandTitle}
                prompt={strings.battle.pickWarbandPrompt}
                emptyMessage={strings.battle.noWarbands}
                destination={(id) => `/warbands/${id}/pre-battle`}
              />
            }
          />
          <Route
            path="/trading"
            element={
              <WarbandPickerScreen
                title={strings.trading.pickWarbandTitle}
                prompt={strings.trading.pickWarbandPrompt}
                emptyMessage={strings.trading.noWarbands}
                destination={(id) => `/warbands/${id}/trading`}
              />
            }
          />
          <Route path="/campaign" element={<CampaignScreen />} />
          <Route path="/rules" element={<RulesScreen />} />
          <Route path="/rules/:ruleId" element={<RuleDetailScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
