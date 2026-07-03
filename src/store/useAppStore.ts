import { create } from 'zustand';
import { Campaign, Warband } from '../types';
import {
  ExportedData,
  deleteWarband as deleteWarbandFromStorage,
  loadAllWarbands,
  loadCampaign,
  saveCampaign as saveCampaignToStorage,
  saveWarband as saveWarbandToStorage,
  importAllData,
} from '../storage/persistence';

type AppState = {
  warbands: Warband[];
  campaign: Campaign | null;
  loaded: boolean;
  load: () => void;
  saveWarband: (warband: Warband) => void;
  deleteWarband: (id: string) => void;
  saveCampaign: (campaign: Campaign) => void;
  importAll: (data: ExportedData) => void;
};

export const useAppStore = create<AppState>((set) => ({
  warbands: [],
  campaign: null,
  loaded: false,

  load: () => {
    set({
      warbands: loadAllWarbands(),
      campaign: loadCampaign(),
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
}));
