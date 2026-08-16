import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  clearEventRsvp,
  fetchEventRsvps,
  setEventRsvp,
  RsvpStatus,
} from '../api/rsvps';

function rsvpsKey(eventId: string | undefined) {
  return ['eventRsvps', eventId] as const;
}

export function useEventRsvpsQuery(eventId: string | undefined) {
  return useQuery({
    queryKey: rsvpsKey(eventId),
    queryFn: () => fetchEventRsvps(eventId!),
    enabled: !!eventId,
  });
}

/**
 * Sets or clears the caller's RSVP. Passing null clears it — tapping the button
 * you already chose is "un-RSVP", which the screen treats as a toggle. RLS
 * restricts the write to your own row.
 */
export function useSetRsvpMutation(eventId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (status: RsvpStatus | null) => {
      if (status === null) await clearEventRsvp(eventId!, user!.id);
      else await setEventRsvp(eventId!, user!.id, status);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rsvpsKey(eventId) }),
  });
  return (status: RsvpStatus | null) => mutation.mutate(status);
}
