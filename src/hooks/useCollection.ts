import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createTerrainPiece,
  deleteTerrainPiece,
  fetchOwnedModels,
  fetchTerrainPieces,
  setOwnedModelCount,
  updateTerrainPiece,
  TerrainPieceInput,
} from '../api/collection';

// The solo collection libraries (§solo). Keyed by user id so a sign-out or
// account switch never serves the previous person's inventory from cache, and
// disabled until signed in — the rows are owner-scoped in the database.

function modelsKey(userId: string | undefined) {
  return ['ownedModels', userId] as const;
}
function terrainKey(userId: string | undefined) {
  return ['terrainPieces', userId] as const;
}

// ── Owned models ────────────────────────────────────────────────────────────

export function useOwnedModelsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: modelsKey(user?.id),
    queryFn: fetchOwnedModels,
    enabled: !!user,
  });
}

export function useSetOwnedModelCountMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (fields: { warbandType: string; unitType: string; count: number }) =>
      setOwnedModelCount(user!.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelsKey(user?.id) }),
  });
  return (fields: { warbandType: string; unitType: string; count: number }) =>
    mutation.mutate(fields);
}

// ── Terrain pieces ──────────────────────────────────────────────────────────

export function useTerrainPiecesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: terrainKey(user?.id),
    queryFn: fetchTerrainPieces,
    enabled: !!user,
  });
}

export function useCreateTerrainPieceMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (fields: TerrainPieceInput) => createTerrainPiece(user!.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: terrainKey(user?.id) }),
  });
  return (fields: TerrainPieceInput, onDone?: () => void) =>
    mutation.mutate(fields, { onSuccess: onDone });
}

export function useUpdateTerrainPieceMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: TerrainPieceInput }) =>
      updateTerrainPiece(id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: terrainKey(user?.id) }),
  });
  return (id: string, fields: TerrainPieceInput, onDone?: () => void) =>
    mutation.mutate({ id, fields }, { onSuccess: onDone });
}

export function useDeleteTerrainPieceMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteTerrainPiece(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: terrainKey(user?.id) }),
  });
  return (id: string) => mutation.mutate(id);
}
