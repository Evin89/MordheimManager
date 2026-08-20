import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import SaveBar from '../components/SaveBar';
import { Card, SectionHeading, Field, TextField } from '../components/ui';
import { strings } from '../strings';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { WarbandDefinition } from '../data/types';
import {
  useCustomWarbandTypesQuery,
  useUpdateCustomWarbandMutation,
} from '../hooks/useCustomWarbands';

/** A number input that treats blank as null (unlimited / unset). */
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  hint?: string;
}) {
  return (
    <Field label={label}>
      <TextField
        type="number"
        inputMode="numeric"
        min={min}
        value={value === null ? '' : String(value)}
        placeholder={hint}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === '' ? null : Math.max(min, Math.floor(Number(raw) || 0)));
        }}
      />
    </Field>
  );
}

export default function CustomWarbandEditScreen() {
  const t = strings.customWarbands;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: types, isLoading } = useCustomWarbandTypesQuery();
  const save = useUpdateCustomWarbandMutation();

  const type = types?.find((x) => x.id === id);
  const [def, setDef] = useState<WarbandDefinition | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed the draft once the type loads — a deep copy, so edits are local until saved.
  useEffect(() => {
    if (type && !def) setDef(structuredClone(type.definition));
  }, [type, def]);

  if (isLoading || (!type && types === undefined)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!type) return <Navigate to="/custom-warbands" replace />;
  if (!def) return null;

  function edit(patch: Partial<WarbandDefinition>) {
    setDef((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setSaved(false);
  }
  function editHero(index: number, patch: { unitType?: string; maxCount?: number | null }) {
    setDef((d) =>
      d ? { ...d, heroSlots: d.heroSlots.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : d,
    );
    setDirty(true);
    setSaved(false);
  }
  function editHench(index: number, patch: { unitType?: string; maxCount?: number | null }) {
    setDef((d) =>
      d
        ? { ...d, henchmenTypes: d.henchmenTypes.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
        : d,
    );
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!def) return;
    const name = def.name.trim() || getWarbandTypeName(type!.baseType);
    const toSave = { ...def, name };
    await save(type!.id, name, toSave);
    setDirty(false);
    setSaved(true);
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={t.editTitle} subtitle={t.clonedFrom(getWarbandTypeName(type.baseType))} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <Field label={t.nameLabel}>
            <TextField
              type="text"
              value={def.name}
              onChange={(e) => edit({ name: e.target.value })}
              placeholder={t.namePlaceholder}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label={t.startingGold}
              value={def.startingGold}
              onChange={(v) => edit({ startingGold: v })}
            />
            <NumberField label={t.minSize} value={def.minWarbandSize} onChange={(v) => edit({ minWarbandSize: v })} />
            <NumberField
              label={t.maxSize}
              value={def.maxWarbandSize}
              onChange={(v) => edit({ maxWarbandSize: v })}
              hint={t.unlimited}
            />
          </div>
          <p className="text-bone-400 text-xs">{t.limitHint}</p>
        </Card>

        <section className="space-y-3">
          <SectionHeading>{t.heroesHeading}</SectionHeading>
          {def.heroSlots.map((slot, i) => (
            <Card key={slot.id} gap="sm">
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <Field label={t.unitNameLabel}>
                    <TextField
                      type="text"
                      value={slot.unitType}
                      onChange={(e) => editHero(i, { unitType: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="w-24 shrink-0">
                  <NumberField
                    label={t.unitMaxLabel}
                    value={slot.maxCount}
                    onChange={(v) => editHero(i, { maxCount: v })}
                    hint={t.unlimited}
                  />
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <SectionHeading>{t.henchmenHeading}</SectionHeading>
          {def.henchmenTypes.map((type_, i) => (
            <Card key={type_.id} gap="sm">
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <Field label={t.unitNameLabel}>
                    <TextField
                      type="text"
                      value={type_.unitType}
                      onChange={(e) => editHench(i, { unitType: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="w-24 shrink-0">
                  <NumberField
                    label={t.unitMaxLabel}
                    value={type_.maxCount}
                    onChange={(v) => editHench(i, { maxCount: v })}
                    hint={t.unlimited}
                  />
                </div>
              </div>
            </Card>
          ))}
        </section>

        {saved && <p className="text-verdigris text-sm">{t.savedNote}</p>}

        <SaveBar dirty={dirty} onSave={handleSave} onDiscard={() => navigate('/custom-warbands')} />
      </main>
    </div>
  );
}
