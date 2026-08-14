/**
 * A model's name as shown to the reader (spec §18.1).
 *
 * The nickname is a byname — "One-Eye", "the Lucky" — shown in parentheses after
 * the given name everywhere the name renders: roster row, print sheet, shared
 * roster. Kept in one place so those four surfaces can't drift on how it's
 * formatted.
 */
export function modelDisplayName(model: { name: string; nickname?: string }): string {
  const nick = model.nickname?.trim();
  return nick ? `${model.name} (${nick})` : model.name;
}
