import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createCampaign,
  fetchCampaignMembers,
  fetchCampaignStandings,
  fetchMyCampaigns,
  joinCampaignByCode,
  regenerateJoinCode,
  removeCampaignMember,
  updateCampaign,
} from '../api/campaign';
import { fetchBattles, insertBattle } from '../api/battles';
import { pickActiveCampaign, writeActiveCampaignId } from '../lib/activeCampaign';
import { Campaign, BattleRecord } from '../types';
import { strings } from '../strings';

function campaignsKey(userId: string | undefined) {
  return ['campaigns', userId] as const;
}

function battlesKey(campaignId: string | undefined) {
  return ['battles', campaignId] as const;
}

function membersKey(campaignId: string | undefined) {
  return ['campaignMembers', campaignId] as const;
}

function standingsKey(campaignId: string | undefined, battleCount: number) {
  return ['standings', campaignId, battleCount] as const;
}

/** Every campaign the user leads or has joined. */
export function useMyCampaignsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: campaignsKey(user?.id),
    queryFn: () => fetchMyCampaigns(user!.id),
    enabled: !!user,
  });
}

/**
 * The one campaign the rest of the app treats as current. Keeps the single-
 * campaign shape the Home screen and post-battle commit were already written
 * against, now that a player can belong to more than one.
 */
export function useMyCampaignQuery() {
  const query = useMyCampaignsQuery();
  return { ...query, data: query.data ? pickActiveCampaign(query.data) : undefined };
}

export function useSetActiveCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return (campaignId: string) => {
    writeActiveCampaignId(campaignId);
    // The choice lives outside React Query, so nudge every consumer to re-pick.
    queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
  };
}

export function useCreateCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ name, usesBtb }: { name: string; usesBtb: boolean }) => createCampaign(name, usesBtb),
    onSuccess: (campaign) => {
      // A campaign you just made is the one you want to be looking at.
      writeActiveCampaignId(campaign.id);
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
    },
  });
  return (name: string, usesBtb: boolean) => mutation.mutate({ name, usesBtb });
}

export function useSaveCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (campaign: Campaign) => updateCampaign(campaign),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (campaign: Campaign) => mutation.mutate(campaign);
}

/** Returns the error message on failure (bad code) rather than throwing, so the
 * join form can show it inline instead of via an alert. */
export function useJoinCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (code: string) => joinCampaignByCode(code),
    onSuccess: (campaignId) => {
      // Switch to what you just joined — otherwise the screen keeps showing the
      // campaign you were already in and the join looks like it did nothing.
      writeActiveCampaignId(campaignId);
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
    },
  });
  return async (code: string): Promise<string | null> => {
    try {
      await mutation.mutateAsync(code);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : strings.campaign.joinFailed;
    }
  };
}

export function useRegenerateJoinCodeMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (campaignId: string) => regenerateJoinCode(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (campaignId: string) => mutation.mutate(campaignId);
}

export function useCampaignMembersQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: membersKey(campaignId),
    queryFn: () => fetchCampaignMembers(campaignId!),
    enabled: !!campaignId,
  });
}

/** Covers both "remove this player" (leader) and "leave" (yourself) — RLS decides. */
export function useRemoveMemberMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(campaignId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
    },
    onError: () => window.alert(strings.connection.lost),
  });
  return (userId: string) => mutation.mutate(userId);
}

export function useBattlesQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: battlesKey(campaignId),
    queryFn: () => fetchBattles(campaignId!),
    enabled: !!campaignId,
  });
}

/**
 * Standings are derived from the linked warbands plus the campaign's battle
 * log, so the query key includes the battle count — reporting a battle should
 * move the table without needing a manual refresh.
 */
export function useStandingsQuery(campaignId: string | undefined, battles: BattleRecord[] | undefined) {
  const results = (battles ?? []).map((b) => ({ warbandId: b.warbandId, result: b.result }));
  return useQuery({
    queryKey: standingsKey(campaignId, results.length),
    queryFn: () => fetchCampaignStandings(campaignId!, results),
    enabled: !!campaignId && battles !== undefined,
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
      let campaigns = queryClient.getQueryData<Campaign[]>(campaignsKey(user?.id));
      if (campaigns === undefined) {
        campaigns = await fetchMyCampaigns(user!.id);
      }
      let campaign = pickActiveCampaign(campaigns);
      if (!campaign) {
        campaign = await createCampaign('My Campaign', false);
        writeActiveCampaignId(campaign.id);
      }
      const inserted = await insertBattle(campaign.id, user!.id, battle);
      return { battle: inserted, campaignId: campaign.id };
    },
    onSuccess: ({ campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: battlesKey(campaignId) });
    },
  });
  return async (battle: BattleRecord) => (await mutation.mutateAsync(battle)).battle;
}
