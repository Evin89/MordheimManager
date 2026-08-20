import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  CustomWarbandType,
  createCustomWarbandType,
  deleteCustomWarbandType,
  fetchCustomWarbandTypes,
  updateCustomWarbandType,
} from '../api/customWarbands';
import { registerCustomWarbandTypes } from '../data/warbandRegistry';
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
