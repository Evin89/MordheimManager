/**
 * The shared UI kit (spec §5). Import primitives from here so a screen reaches
 * for one canonical Button/Card/Field/heading instead of re-spelling Tailwind.
 * See `src/screens/DesignSandboxScreen.tsx` (/design) for the live gallery in
 * both themes.
 */
export { default as Button, buttonClasses } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';
export { default as Card } from './Card';
export { SectionHeading, Eyebrow } from './Section';
export { Field, TextField, Textarea, Select, fieldClasses } from './Field';
