import { create } from 'zustand';
import { Campaign, Warband } from '../types';
import {
  ExportedData,
  LastBattleSnapshot,
  clearCampaign,
  clearLastBattleSnapshot,
  deleteWarband as deleteWarbandFromStorage,
  loadAllWarbands,
  loadCampaign,
  loadLastBattleSnapshot,
  saveCampaign as saveCampaignToStorage,
  saveLastBattleSnapshot,
  saveWarband as saveWarbandToStorage,
  importAllData,
} from '../storage/persistence';

type AppState = {
  warbands: Warband[];
  campaign: Campaign | null;
  loaded: boolean;
  lastBattleSnapshot: LastBattleSnapshot | null;
  load: () => void;
  saveWarband: (warband: Warband) => void;
  deleteWarband: (id: string) => void;
  saveCampaign: (campaign: Campaign) => void;
  importAll: (data: ExportedData) => void;
  /** Commits a post-battle sequence atomically: stores an undo snapshot, then saves the updated warband + campaign in one go. */
  commitBattle: (warband: Warband, campaign: Campaign) => void;
  undoLastBattle: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  warbands: [],
  campaign: null,
  loaded: false,
  lastBattleSnapshot: null,

  load: () => {
    set({
      warbands: loadAllWarbands(),
      campaign: loadCampaign(),
      lastBattleSnapshot: loadLastBattleSnapshot(),
      loaded: true,
    });
  },

  saveWarband: (warband) => {
    saveWarbandToStorage(warband);
    set((state) => {
      const others = state.warbands.filter((w) => w.id !== warband.id);
      return { warbands: [...others, warband] };
    });
  },

  deleteWarband: (id) => {
    deleteWarbandFromStorage(id);
    set((state) => ({ warbands: state.warbands.filter((w) => w.id !== id) }));
  },

  saveCampaign: (campaign) => {
    saveCampaignToStorage(campaign);
    set({ campaign });
  },

  importAll: (data) => {
    importAllData(data);
    set({ warbands: data.warbands, campaign: data.campaign });
  },

  commitBattle: (warband, campaign) => {
    const state = get();
    const preBattleWarband = state.warbands.find((w) => w.id === warband.id);
    if (preBattleWarband) {
      saveLastBattleSnapshot({ warbandId: warband.id, warband: preBattleWarband, campaign: state.campaign });
    }
    saveWarbandToStorage(warband);
    saveCampaignToStorage(campaign);
    set({
      warbands: [...state.warbands.filter((w) => w.id !== warband.id), warband],
      campaign,
      lastBattleSnapshot: loadLastBattleSnapshot(),
    });
  },

  undoLastBattle: () => {
    const snapshot = loadLastBattleSnapshot();
    if (!snapshot) return;
    saveWarbandToStorage(snapshot.warband);
    if (snapshot.campaign) {
      saveCampaignToStorage(snapshot.campaign);
    } else {
      clearCampaign();
    }
    clearLastBattleSnapshot();
    set((state) => ({
      warbands: [...state.warbands.filter((w) => w.id !== snapshot.warbandId), snapshot.warband],
      campaign: snapshot.campaign,
      lastBattleSnapshot: null,
    }));
  },
}));
