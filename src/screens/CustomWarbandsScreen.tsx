import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { Button, Card, SectionHeading, Field, TextField, Select } from '../components/ui';
import { strings } from '../strings';
import { warbandDefinitionsByName, getWarbandTypeName } from '../data/warbandRegistry';
import {
  useCustomWarbandTypesQuery,
  useCreateCustomWarbandMutation,
  useDeleteCustomWarbandMutation,
} from '../hooks/useCustomWarbands';

/**
 * Manage the signed-in user's custom (clone-and-rename) warband types (§21.2):
 * clone a built-in one, then edit its name and limits on the detail screen. The
 * types sync to the account and appear in the New Warband picker.
 */
export default function CustomWarbandsScreen() {
  const t = strings.customWarbands;
  const navigate = useNavigate();
  const { data: types } = useCustomWarbandTypesQuery();
  const create = useCreateCustomWarbandMutation();
  const remove = useDeleteCustomWarbandMutation();

  const [baseType, setBaseType] = useState(warbandDefinitionsByName[0]?.id ?? '');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await create(baseType, name.trim() || getWarbandTypeName(baseType));
      setName('');
      navigate(`/custom-warbands/${created.id}`);
    } catch {
      setError(t.createFailed);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={t.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <p className="text-bone-300 text-sm">{t.intro}</p>

        <Card as="section">
          <SectionHeading>{t.create}</SectionHeading>
          <Field label={t.baseLabel}>
            <Select value={baseType} onChange={(e) => setBaseType(e.target.value)}>
              {warbandDefinitionsByName.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.nameLabel}>
            <TextField
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
            />
          </Field>
          {error && <p className="text-blood-500 text-sm">{error}</p>}
          <Button disabled={creating} onClick={handleCreate}>
            {creating ? t.creating : t.create}
          </Button>
        </Card>

        <section className="space-y-2">
          <SectionHeading>{t.title}</SectionHeading>
          {(types?.length ?? 0) === 0 ? (
            <p className="text-bone-300 text-sm">{t.empty}</p>
          ) : (
            (types ?? []).map((type) => (
              <div
                key={type.id}
                className="rounded-lg bg-ink-900 border border-ink-800 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-bone-100 font-semibold truncate">{type.name}</p>
                  <p className="text-bone-400 text-xs truncate">
                    {t.clonedFrom(getWarbandTypeName(type.baseType))}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/custom-warbands/${type.id}`}
                    className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
                  >
                    {t.edit}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.removeConfirm(type.name))) remove(type.id);
                    }}
                    className="inline-flex items-center min-h-[44px] text-blood-500 text-sm font-semibold"
                  >
                    {t.remove}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
