import BackHeader from '../../components/BackHeader';
import { Card, SectionHeading } from '../../components/ui';
import ModelLibraryEditor from '../../components/solo/ModelLibraryEditor';
import TerrainLibraryEditor from '../../components/solo/TerrainLibraryEditor';
import {
  useOwnedModelsQuery,
  useSetOwnedModelCountMutation,
  useTerrainPiecesQuery,
  useCreateTerrainPieceMutation,
  useUpdateTerrainPieceMutation,
  useDeleteTerrainPieceMutation,
} from '../../hooks/useCollection';

/**
 * "My collection" (§solo, beta): the models and terrain the player owns. The
 * solo generator reads both — enemies are mustered only from models you own, and
 * the board is laid out from your terrain — so a generated game is always one you
 * can put on the table. Account-synced, so it follows you between devices.
 */
export default function SoloCollectionScreen() {
  const { data: owned = [], isLoading: modelsLoading } = useOwnedModelsQuery();
  const setCount = useSetOwnedModelCountMutation();

  const { data: terrain = [], isLoading: terrainLoading } = useTerrainPiecesQuery();
  const createTerrain = useCreateTerrainPieceMutation();
  const updateTerrain = useUpdateTerrainPieceMutation();
  const deleteTerrain = useDeleteTerrainPieceMutation();

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title="My collection" badge="Beta" />
      <p className="px-4 pt-4 text-bone-300 text-sm">
        The models and terrain you own. Solo games are generated only from these — no enemy you can’t field, no
        board you can’t build.
      </p>

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <SectionHeading>Models</SectionHeading>
          <p className="text-bone-300 text-sm">
            Tell the app which models you own, by warband type. The solo opponent is mustered from this
            pool.
          </p>
          {modelsLoading ? (
            <p className="text-bone-400 text-sm">Loading…</p>
          ) : (
            <ModelLibraryEditor
              owned={owned}
              onSetCount={(warbandType, unitType, count) => setCount({ warbandType, unitType, count })}
            />
          )}
        </Card>

        <Card as="section">
          <SectionHeading>Terrain</SectionHeading>
          <p className="text-bone-300 text-sm">
            The terrain pieces you own, by type and footprint. The generated board is laid out from these.
          </p>
          {terrainLoading ? (
            <p className="text-bone-400 text-sm">Loading…</p>
          ) : (
            <TerrainLibraryEditor
              pieces={terrain}
              onCreate={createTerrain}
              onUpdate={updateTerrain}
              onDelete={deleteTerrain}
            />
          )}
        </Card>
      </main>
    </div>
  );
}
