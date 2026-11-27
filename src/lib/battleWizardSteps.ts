export const WIZARD_STEPS = [
  'info', 'injuries', 'experience', 'exploration', 'advances', 'deadModels', 'upkeep', 'confirm',
] as const;
export type WizardStep = typeof WIZARD_STEPS[number];
const LEGACY_STEPS: readonly WizardStep[] = [
  'info', 'injuries', 'experience', 'advances', 'deadModels', 'exploration', 'upkeep', 'confirm',
];
const FRIENDLY_STEPS = ['info', 'confirm'] as const;

export function wizardSteps(friendly: boolean): readonly WizardStep[] {
  return friendly ? FRIENDLY_STEPS : WIZARD_STEPS;
}

export function wizardStep(step: WizardStep | number | undefined, friendly: boolean): WizardStep {
  if (typeof step === 'number') return (friendly ? FRIENDLY_STEPS : LEGACY_STEPS)[step] ?? 'info';
  return step ?? 'info';
}

export function visitedWizardSteps(step: WizardStep | number | undefined, friendly: boolean): WizardStep[] {
  const current = wizardStep(step, friendly);
  const path = friendly ? FRIENDLY_STEPS : typeof step === 'number' ? LEGACY_STEPS : WIZARD_STEPS;
  return path.slice(0, path.indexOf(current) + 1);
}

export function wizardProgress(wizard: { step: WizardStep | number; draft: unknown; visited?: WizardStep[] }): [number, number] {
  const friendly = !!(wizard.draft as { friendly?: boolean } | undefined)?.friendly;
  const fullPath = wizard.visited?.some((id) => id !== 'info' && id !== 'confirm')
    || (typeof wizard.step === 'number'
      ? wizard.step > 1
      : wizard.step !== 'info' && wizard.step !== 'confirm');
  const shortPath = friendly && !fullPath;
  const steps = wizardSteps(shortPath);
  return [Math.max(1, steps.indexOf(wizardStep(wizard.step, shortPath)) + 1), steps.length];
}
