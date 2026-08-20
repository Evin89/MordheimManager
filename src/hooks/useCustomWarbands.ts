import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  CustomWarbandType,
  createCustomWarbandType,
  deleteCustomWarbandType,
  fetchCustomWarbandTypeById,
  fetchCustomWarbandTypes,
  updateCustomWarbandType,
} from '../api/customWarbands';
import {
  getWarbandDefinition,
  registerCustomWarbandTypes,
  registerForeignCustomType,
} from '../data/warbandRegistry';
import { CUSTOM_ID_PREFIX, isCustomWarbandType } from '../lib/customWarband';
import { WarbandDefinition } from '../data/types';

const KEY = ['customWarbandTypes'] as const;

export function useCustomWarbandTypesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY,
    queryFn: fetchCustomWarbandTypes,
    enabled: !!user,
  });
}

/**
 * Mirrors the fetched custom types into the module registry so the pure
 * resolvers in `warbandRegistry` (used by the factory, roster and health check)
 * can find them. Mounted once high in the tree — see App. Registers an empty set
 * while loading or signed out, which correctly resolves nothing.
 */
export function useRegisterCustomWarbands(): void {
  const { data } = useCustomWarbandTypesQuery();
  useEffect(() => {
    registerCustomWarbandTypes((data ?? []).map((t) => t.definition));
  }, [data]);
}

/**
 * Ensures a warband's type is resolvable, fetching it when it's a custom type
 * owned by someone else (a shared roster, an opponent, a public warband).
 *
 * Bundled types and the signed-in user's own customs are already in the
 * registry, so those need no fetch and `ready` is immediately true. A foreign
 * custom id is fetched by its bare row id and registered; `ready` flips true on
 * the re-render that follows, which is the caller's cue that the type name and
 * unit rules will now resolve. Returns ready for `undefined` so a screen can
 * call it unconditionally before its warband has loaded.
 */
export function useEnsureWarbandType(warbandType: string | undefined): {
  ready: boolean;
  loading: boolean;
} {
  const alreadyResolvable = warbandType === undefined || getWarbandDefinition(warbandType) !== undefined;
  const isForeignCustom = !!warbandType && isCustomWarbandType(warbandType) && !alreadyResolvable;
  const rowId = isForeignCustom ? warbandType!.slice(CUSTOM_ID_PREFIX.length) : '';

  const query = useQuery({
    queryKey: ['foreignCustomType', rowId],
    queryFn: async () => {
      const type = await fetchCustomWarbandTypeById(rowId);
      if (type) registerForeignCustomType(type.definition);
      // Null (a deleted type) is a valid, cached answer — don't retry forever.
      return type ?? null;
    },
    enabled: isForeignCustom,
    staleTime: Infinity,
  });

  return {
    ready: alreadyResolvable || query.isFetched,
    loading: isForeignCustom && query.isLoading,
  };
}

export function useCreateCustomWarbandMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ baseType, name }: { baseType: string; name: string }) =>
      createCustomWarbandType(baseType, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  return (baseType: string, name: string): Promise<CustomWarbandType> =>
    mutation.mutateAsync({ baseType, name });
}

export function useUpdateCustomWarbandMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, name, definition }: { id: string; name: string; definition: WarbandDefinition }) =>
      updateCustomWarbandType(id, name, definition),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  return (id: string, name: string, definition: WarbandDefinition): Promise<CustomWarbandType> =>
    mutation.mutateAsync({ id, name, definition });
}

export function useDeleteCustomWarbandMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteCustomWarbandType(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  return (id: string) => mutation.mutate(id);
}
