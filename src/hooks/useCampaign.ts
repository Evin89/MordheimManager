import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createCampaign,
  deleteCampaign,
  fetchCampaignMembers,
  fetchCampaignStandings,
  fetchCampaignSummaries,
  fetchMyCampaigns,
  joinCampaignByCode,
  regenerateJoinCode,
  removeCampaignMember,
  transferCampaignLeadership,
  grantCampaignLeadership,
  revokeCampaignLeadership,
  updateCampaign,
  setCampaignAnnouncement,
} from '../api/campaign';
import { deleteBattle, fetchBattles, fetchPersonalBattles, insertBattle } from '../api/battles';
import { fetchCampaignWarbands } from '../api/warbands';
import { pickActiveCampaign, writeActiveCampaignId } from '../lib/activeCampaign';
import { Campaign, BattleRecord } from '../types';
import { strings } from '../strings';

function warbandsKeyForInvalidate() {
  return ['warbands'] as const;
}

function campaignsKey(userId: string | undefined) {
  return ['campaigns', userId] as const;
}

function battlesKey(campaignId: string | undefined) {
  return ['battles', campaignId] as const;
}

function personalBattlesKey(userId: string | undefined) {
  return ['personalBattles', userId] as const;
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

/** Every campaign you're in, with role and activity — for the overview screen. */
export function useCampaignSummariesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['campaignSummaries', user?.id],
    queryFn: () => fetchCampaignSummaries(user!.id),
    enabled: !!user,
  });
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

/**
 * §19.3 — pin or clear the campaign announcement. Leader-only at the database;
 * the campaigns list carries the pinned text, so invalidating it re-renders both
 * the banner and the leader's editor.
 */
export function useSetAnnouncementMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (text: string | null) => setCampaignAnnouncement(campaignId!, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (text: string | null) => mutation.mutate(text);
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

/**
 * Deletes a campaign, then sends the user back to the campaign list.
 *
 * Refused by the database while other members remain (0011). The error is
 * returned rather than thrown so the screen can explain it inline.
 */
export function useDeleteCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (campaignId: string) => deleteCampaign(campaignId),
    onSuccess: () => {
      // The active-campaign pick lives outside React Query and may now point
      // at a campaign that no longer exists.
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['campaignSummaries', user?.id] });
      queryClient.invalidateQueries({ queryKey: warbandsKeyForInvalidate() });
    },
  });
  return async (campaignId: string): Promise<string | null> => {
    try {
      await mutation.mutateAsync(campaignId);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not delete that campaign.';
    }
  };
}

/** Removes one entry from the shared battle log. Reporter or leader, decided by
 * the policy; the standings key includes the battle count, so both move. */
export function useDeleteBattleMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteBattle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: battlesKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
      queryClient.invalidateQueries({ queryKey: ['campaignSummaries'] });
    },
  });
  return (id: string) => mutation.mutate(id);
}

export function useCampaignMembersQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: membersKey(campaignId),
    queryFn: () => fetchCampaignMembers(campaignId!),
    enabled: !!campaignId,
  });
}

/**
 * Hands leadership to another member.
 *
 * Returns the error message rather than throwing, so the Players list can show
 * it inline — the failures here are all things the user can act on ("that
 * player is not in this campaign"), not connection faults.
 */
export function useTransferLeadershipMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (toUserId: string) => transferCampaignLeadership(campaignId!, toUserId),
    onSuccess: () => {
      // Who leads decides what the whole screen offers, so both the member list
      // and the campaign list have to re-read it.
      queryClient.invalidateQueries({ queryKey: membersKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['campaignSummaries', user?.id] });
    },
  });
  return async (toUserId: string): Promise<string | null> => {
    try {
      await mutation.mutateAsync(toUserId);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not transfer leadership.';
    }
  };
}

/**
 * Promote a member to co-leader, or demote a leader back to a player.
 *
 * One hook for both because they invalidate identically and fail identically —
 * with a message the user can act on ("this campaign would have none"), which
 * the Players list shows inline rather than throwing.
 */
function useLeadershipMutation(
  campaignId: string | undefined,
  fn: (campaignId: string, userId: string) => Promise<void>,
  fallback: string,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (userId: string) => fn(campaignId!, userId),
    onSuccess: () => {
      // Who leads decides what the whole screen offers, so both the member list
      // and the campaign list have to re-read it.
      queryClient.invalidateQueries({ queryKey: membersKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['campaignSummaries', user?.id] });
    },
  });
  return async (userId: string): Promise<string | null> => {
    try {
      await mutation.mutateAsync(userId);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : fallback;
    }
  };
}

export function useGrantLeadershipMutation(campaignId: string | undefined) {
  return useLeadershipMutation(
    campaignId,
    grantCampaignLeadership,
    'Could not make that player a leader.',
  );
}

export function useRevokeLeadershipMutation(campaignId: string | undefined) {
  return useLeadershipMutation(
    campaignId,
    revokeCampaignLeadership,
    'Could not remove that leader.',
  );
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
    // The 0010 trigger refuses a leader who would orphan the campaign. That is
    // a rule, not a connection fault, so it must not be reported as one.
    onError: (err) =>
      window.alert(err instanceof Error ? err.message : strings.connection.lost),
  });
  return (userId: string) => mutation.mutate(userId);
}

/**
 * Every warband entered in the campaign, for picking an opponent.
 *
 * Separate from `useWarbandsQuery`, which is scoped to warbands you own — the
 * whole point here is the *other* players' rosters, which are reachable only
 * through the campaign-membership branch of the RLS select policy.
 */
export function useCampaignWarbandsQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaignWarbands', campaignId],
    queryFn: () => fetchCampaignWarbands(campaignId!),
    enabled: !!campaignId,
  });
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
 * Post-battle wizard commit.
 *
 * Files the battle against the active campaign when there is one, and against
 * no campaign at all when there isn't. It used to silently create a campaign
 * called "My Campaign" on first commit, because `battles` had nowhere to put a
 * row otherwise — which meant every player ended up with a campaign they never
 * started, and starting a real one felt like it had already happened. Playing a
 * one-off game outside a campaign is a legitimate thing to do, so that's now
 * what it records.
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
      const campaign = pickActiveCampaign(campaigns);
      const inserted = await insertBattle(campaign?.id ?? null, user!.id, battle);
      return { battle: inserted, campaignId: campaign?.id ?? null };
    },
    onSuccess: ({ campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignsKey(user?.id) });
      queryClient.invalidateQueries({
        queryKey: campaignId ? battlesKey(campaignId) : personalBattlesKey(user?.id),
      });
    },
  });
  return async (battle: BattleRecord) => (await mutation.mutateAsync(battle)).battle;
}

/** Battles fought outside any campaign, so the post-battle history isn't lost
 * for players who haven't started one. */
export function usePersonalBattlesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: personalBattlesKey(user?.id),
    queryFn: () => fetchPersonalBattles(user!.id),
    enabled: !!user,
  });
}
