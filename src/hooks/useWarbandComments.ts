import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addWarbandComment,
  deleteWarbandComment,
  fetchWarbandComments,
} from '../api/warbandComments';

function commentsKey(warbandId: string | undefined) {
  return ['warband-comments', warbandId] as const;
}

export function useWarbandCommentsQuery(warbandId: string | undefined) {
  return useQuery({
    queryKey: commentsKey(warbandId),
    queryFn: () => fetchWarbandComments(warbandId!),
    enabled: !!warbandId,
  });
}

export function useAddWarbandCommentMutation(warbandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ authorId, body }: { authorId: string; body: string }) =>
      addWarbandComment(warbandId, authorId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(warbandId) }),
  });
}

export function useDeleteWarbandCommentMutation(warbandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWarbandComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(warbandId) }),
  });
}
