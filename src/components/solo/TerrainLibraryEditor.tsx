import { useState } from 'react';
import { TerrainCategory, TerrainPiece, TerrainPieceInput } from '../../api/collection';
import { Button, Field, Select, TextField, Textarea } from '../ui';

const CATEGORIES: { value: TerrainCategory; label: string }[] = [
  { value: 'building', label: 'Building / ruin' },
  { value: 'forest', label: 'Forest / trees' },
  { value: 'water', label: 'River / pond' },
  { value: 'hill', label: 'Hill' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABEL: Record<TerrainCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<TerrainCategory, string>;

type FormState = {
  category: TerrainCategory;
  name: string;
  width: string;
  depth: string;
  height: string;
  levels: string;
  quantity: string;
  notes: string;
};

const EMPTY: FormState = {
  category: 'building',
  name: '',
  width: '',
  depth: '',
  height: '',
  levels: '',
  quantity: '1',
  notes: '',
};

const num = (s: string): number | null => {
  const n = parseFloat(s);
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};
const int = (s: string): number | null => {
  const n = parseInt(s, 10);
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

function toInput(f: FormState): TerrainPieceInput {
  return {
    category: f.category,
    name: f.name,
    width: num(f.width),
    depth: num(f.depth),
    height: num(f.height),
    levels: int(f.levels),
    quantity: Math.max(1, parseInt(f.quantity, 10) || 1),
    notes: f.notes,
  };
}

function fromPiece(p: TerrainPiece): FormState {
  const s = (n: number | null) => (n == null ? '' : String(n));
  return {
    category: p.category,
    name: p.name,
    width: s(p.width),
    depth: s(p.depth),
    height: s(p.height),
    levels: s(p.levels),
    quantity: String(p.quantity),
    notes: p.notes,
  };
}

/** A footprint like `6 × 4″`, or a dash when unrecorded. */
function footprint(p: TerrainPiece): string {
  if (p.width == null && p.depth == null) return '—';
  return `${p.width ?? '?'} × ${p.depth ?? '?'}″`;
}

/**
 * The terrain-library editor: the pieces you own, by category and footprint. The
 * solo map is laid out from these — scaled to their size and labelled — so a
 * generated board is one you can actually build.
 */
export default function TerrainLibraryEditor({
  pieces,
  onCreate,
  onUpdate,
  onDelete,
}: {
  pieces: TerrainPiece[];
  onCreate: (fields: TerrainPieceInput, onDone: () => void) => void;
  onUpdate: (id: string, fields: TerrainPieceInput, onDone: () => void) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  function save() {
    if (!form.name.trim()) return;
    const fields = toInput(form);
    if (editingId) onUpdate(editingId, fields, reset);
    else onCreate(fields, reset);
  }

  function edit(p: TerrainPiece) {
    setForm(fromPiece(p));
    setEditingId(p.id);
  }

  return (
    <div className="space-y-4">
      {pieces.length > 0 && (
        <ul className="space-y-2">
          {pieces.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-ink-700 bg-ink-900 p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-bone-100 text-sm font-semibold">
                  {p.name}
                  {p.quantity > 1 && <span className="text-bone-400 font-normal"> ×{p.quantity}</span>}
                </p>
                <p className="text-bone-400 text-xs">
                  {CATEGORY_LABEL[p.category]} · {footprint(p)}
                  {p.levels != null && ` · ${p.levels} level${p.levels === 1 ? '' : 's'}`}
                  {p.height != null && ` · ${p.height}″ tall`}
                </p>
                {p.notes && <p className="text-bone-400 text-xs mt-1">{p.notes}</p>}
              </div>
              <div className="flex gap-1.5 flex-none">
                <button
                  type="button"
                  onClick={() => edit(p)}
                  className="min-h-[36px] px-3 rounded-md border border-ink-700 text-bone-200 text-xs hover:bg-ink-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove “${p.name}” from your terrain?`)) onDelete(p.id);
                  }}
                  className="min-h-[36px] px-3 rounded-md border border-blood-600 text-blood-500 text-xs hover:bg-blood-600 hover:text-bone-100"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md bg-ink-950 border border-ink-800 p-3 space-y-3">
        <p className="text-bone-100 text-sm font-semibold">
          {editingId ? 'Edit piece' : 'Add a terrain piece'}
        </p>

        <Field label="Type" htmlFor="terrain-category">
          <Select
            id="terrain-category"
            value={form.category}
            onChange={(e) => set({ category: e.target.value as TerrainCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Name" htmlFor="terrain-name">
          <TextField
            id="terrain-name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Ruined tower, Pine copse, Stream"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Width (in)" htmlFor="terrain-width">
            <TextField
              id="terrain-width"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.width}
              onChange={(e) => set({ width: e.target.value })}
            />
          </Field>
          <Field label="Depth (in)" htmlFor="terrain-depth">
            <TextField
              id="terrain-depth"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.depth}
              onChange={(e) => set({ depth: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Height (in)" htmlFor="terrain-height">
            <TextField
              id="terrain-height"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.height}
              onChange={(e) => set({ height: e.target.value })}
            />
          </Field>
          <Field label="Levels" htmlFor="terrain-levels">
            <TextField
              id="terrain-levels"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.levels}
              onChange={(e) => set({ levels: e.target.value })}
            />
          </Field>
          <Field label="Quantity" htmlFor="terrain-qty">
            <TextField
              id="terrain-qty"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.quantity}
              onChange={(e) => set({ quantity: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Notes (optional)" htmlFor="terrain-notes">
          <Textarea
            id="terrain-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <div className="flex gap-2">
          <Button size="dense" fullWidth={false} disabled={!form.name.trim()} onClick={save}>
            {editingId ? 'Save changes' : 'Add piece'}
          </Button>
          {editingId && (
            <Button variant="secondary" size="dense" fullWidth={false} onClick={reset}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
