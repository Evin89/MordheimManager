/**
 * The screen's footer action (§40): one sticky bar at the foot of the content,
 * above the phone tab bar (its 56px plus the device's safe area), flush to the
 * bottom on the desktop rail. The save bar uses it, and so do the three battle
 * screens' "next stage" buttons — before, each screen ended in its own button
 * at its own spot, scrolled out of reach on a long step.
 *
 * Render it as the last child of a screen's `<main className="px-4 …">`: the
 * negative margin takes it edge to edge of that padding.
 */
export default function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="print:hidden sticky bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-20 -mx-4 mt-6 px-4 py-3 bg-ink-950/95 backdrop-blur border-t border-ink-800 space-y-2">
      {children}
    </div>
  );
}
