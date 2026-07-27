import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { createCampaign, fetchMyCampaign, updateCampaign } from '../api/campaign';
import { fetchBattles, insertBattle } from '../api/battles';
import { Campaign, BattleRecord } from '../types';
import { strings } from '../strings';

function campaignKey(userId: string | undefined) {
  return ['campaign', userId] as const;
}

function battlesKey(campaignId: string | undefined) {
  return ['battles', campaignId] as const;
}

export function useMyCampaignQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: campaignKey(user?.id),
    queryFn: () => fetchMyCampaign(user!.id),
    enabled: !!user,
  });
}

export function useCreateCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ name, usesBtb }: { name: string; usesBtb: boolean }) => createCampaign(name, usesBtb),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKey(user?.id) }),
  });
  return (name: string, usesBtb: boolean) => mutation.mutate({ name, usesBtb });
}

export function useSaveCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (campaign: Campaign) => updateCampaign(campaign),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (campaign: Campaign) => mutation.mutate(campaign);
}

export function useBattlesQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: battlesKey(campaignId),
    queryFn: () => fetchBattles(campaignId!),
    enabled: !!campaignId,
  });
}

/**
 * Post-battle wizard commit: ensures the player has a campaign to log into
 * (creating a default one on first use, same fallback the old local-only
 * Campaign singleton had), then records the BattleRecord.
 */
export function useLogBattleMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (battle: BattleRecord) => {
      let campaign = queryClient.getQueryData<Campaign | null>(campaignKey(user?.id));
      if (campaign === undefined) {
        campaign = await fetchMyCampaign(user!.id);
      }
      if (!campaign) {
        campaign = await createCampaign('My Campaign', false);
      }
      const inserted = await insertBattle(campaign.id, user!.id, battle);
      return { battle: inserted, campaignId: campaign.id };
    },
    onSuccess: ({ campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: battlesKey(campaignId) });
    },
  });
  return async (battle: BattleRecord) => (await mutation.mutateAsync(battle)).battle;
}
