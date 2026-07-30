import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveWarbandMutation } from './useWarbands';
import { Warband } from '../types';

/**
 * A local, editable copy of a warband that is only written when the user says so.
 *
 * Field edits used to hit the database on every keystroke: typing a
 * characteristic fired one save per digit, and there was no moment where the
 * user decided the change was finished. That made every stat correction a
 * burst of writes, gave no way to abandon a mis-tap, and meant a dropped
 * connection surfaced as a failure alert in the middle of typing.
 *
 * Discrete actions — buying, recruiting, selling, deleting — deliberately keep
 * saving immediately. They already *are* the user's decision, and putting a
 * second "Save" behind a Buy button would read as the purchase not having
 * happened.
 *
 * The draft re-syncs from the server copy only while it's clean, so a refetch
 * (or another device's write landing) never overwrites edits in progress.
 */
export function useWarbandDraft(warband: Warband | undefined) {
  const saveWarband = useSaveWarbandMutation();
  // Only the *edited* copy is state. The draft itself is derived, so it exists
  // the moment the warband does.
  //
  // Seeding state with `useState(warband)` instead left a one-render window on
  // every cold load: the initial value was captured while the query was still
  // pending, so when the warband arrived the draft was still undefined for one
  // render. Screens guarding on `!warband || !draft` redirected during exactly
  // that render, which is why opening a roster by URL or refreshing one bounced
  // back to the list.
  const [edited, setEdited] = useState<Warband | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const draft = edited ?? warband;

  // Read inside the effect without making it a dependency: adopting the server
  // copy must depend on the incoming warband, not on every keystroke.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const warbandRef = useRef(warband);
  warbandRef.current = warband;

  useEffect(() => {
    // Dropping the edited copy lets the derived draft fall back to the server
    // one, which is what "re-sync while clean" means now.
    if (!dirtyRef.current) setEdited(undefined);
  }, [warband]);

  const update = useCallback((patch: Partial<Warband> | ((current: Warband) => Partial<Warband>)) => {
    setEdited((current) => {
      const base = current ?? warbandRef.current;
      if (!base) return current;
      const resolved = typeof patch === 'function' ? patch(base) : patch;
      return { ...base, ...resolved };
    });
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    if (!draft || !dirty) return;
    saveWarband(draft);
    setDirty(false);
  }, [draft, dirty, saveWarband]);

  /**
   * For discrete actions — buying, recruiting, adding an injury — which are
   * their own confirmation and shouldn't wait behind a Save button.
   *
   * Applies the change *on top of the current draft* and writes the result, so
   * a screen never holds two competing versions of the warband: any field edits
   * still pending are carried along rather than being lost or overwritten a
   * moment later. That also clears the dirty flag, which is honest — everything
   * on screen is now saved.
   */
  const saveNow = useCallback(
    (patch: Partial<Warband> | ((current: Warband) => Partial<Warband>)) => {
      setEdited((current) => {
        const base = current ?? warbandRef.current;
        if (!base) return current;
        const resolved = typeof patch === 'function' ? patch(base) : patch;
        const next = { ...base, ...resolved };
        saveWarband(next);
        return next;
      });
      setDirty(false);
    },
    [saveWarband],
  );

  // Dropping the edit makes the derived draft fall back to the server copy.
  const discard = useCallback(() => {
    setEdited(undefined);
    setDirty(false);
  }, []);

  return { draft, update, dirty, save, saveNow, discard };
}

/**
 * Warns before leaving the tab with unsaved edits.
 *
 * Only covers reloads and closing the tab — in-app navigation is handled by the
 * save bar staying visible, since a router-level block would fight the wizard
 * and the shop, which navigate deliberately.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Browsers ignore custom text now, but returnValue is still what triggers
      // the prompt at all.
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
