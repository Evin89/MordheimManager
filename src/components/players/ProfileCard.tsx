import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { MAX_DISPLAY_NAME } from '../../api/profile';
import { MAX_BIO } from '../../api/players';
import {
  useAvatarMutations,
  useAvatarUrls,
  usePlayerProfileQuery,
  useSetMyDirectoryMutation,
  useUpdateMyProfileMutation,
} from '../../hooks/usePlayers';
import { countryOptions } from '../../lib/countries';
import { builtInWarbandNames } from '../../data/warbandNames';
import { strings } from '../../strings';
import { capture } from '../../lib/posthog';
import { Button, Card, Field, TextField, Textarea, buttonClasses } from '../ui';
import PlayerAvatar from './PlayerAvatar';
import SearchPicker from './SearchPicker';

type Draft = { displayName: string; bio: string; favouriteWarbandType: string; country: string };

/**
 * §38 — the profile form; since §39.3 the body of /account/profile rather
 * than a card on Account.
 *
 * Replaces the lone display-name field: name, photo, country, favourite
 * warband and bio are edited together and saved with one `update_my_profile`
 * call. The photo is the exception — it saves the moment it's picked, the way
 * warband photos do, because an upload is its own action with its own failure.
 */
export default function ProfileCard() {
  const { user } = useAuth();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const avatars = useAvatarUrls(user ? [user.id] : []);
  const save = useUpdateMyProfileMutation();
  const photo = useAvatarMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const s = strings.profile;
  const { hash } = useLocation();

  // `#directory` comes from Account's Listed chip and the profile's
  // visibility strip. The switches only render once the profile has loaded,
  // so the browser's own jump would find nothing to scroll to.
  const loadedProfile = !!profile;
  useEffect(() => {
    if (hash === '#directory' && loadedProfile) document.getElementById('directory')?.scrollIntoView();
  }, [hash, loadedProfile]);

  const warbandOptions = useMemo(() => builtInWarbandNames.map((w) => ({ id: w.id, label: w.name })), []);
  const countries = useMemo(() => countryOptions(), []);

  if (!user) return null;

  const loaded: Draft = {
    displayName: profile?.displayName ?? '',
    bio: profile?.bio ?? '',
    favouriteWarbandType: profile?.favouriteWarbandType ?? '',
    country: profile?.country ?? '',
  };
  // Null until the user edits, so a save elsewhere is picked up rather than
  // pinned to the first render (same pattern as the old name field).
  const value = draft ?? loaded;
  const dirty = !!profile && JSON.stringify({ ...value, displayName: value.displayName.trim() }) !== JSON.stringify(loaded);
  const nameOk = value.displayName.trim().length > 0;
  const set = (patch: Partial<Draft>) => setDraft({ ...value, ...patch });

  async function onPick(file: File | undefined) {
    if (!file) return;
    setPhotoError(await photo.upload(file));
    if (inputRef.current) inputRef.current.value = '';
  }

  const hasPhoto = !!profile?.avatarPath;

  return (
    <Card as="section" id="profile">
      <p className="text-bone-300 text-sm">{s.cardHint}</p>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <PlayerAvatar
          url={avatars[user.id]}
          name={value.displayName || '?'}
          seed={profile?.avatarSeed ?? user.id}
          size="md"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="profile-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <label
            htmlFor="profile-photo"
            aria-disabled={photo.busy}
            className={`min-h-[44px] px-4 flex items-center rounded-md border border-ink-700 text-bone-100 font-semibold cursor-pointer ${
              photo.busy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-ink-800'
            }`}
          >
            {photo.uploading ? s.photoUploading : hasPhoto ? s.photoReplace : s.photoUpload}
          </label>
          {hasPhoto ? (
            <Button variant="secondary" disabled={photo.busy} onClick={async () => setPhotoError(await photo.clear())}>
              {s.photoRemove}
            </Button>
          ) : (
            <Button variant="secondary" disabled={photo.busy} onClick={async () => setPhotoError(await photo.reroll())}>
              {s.photoReroll}
            </Button>
          )}
        </div>
      </div>
      <p className="text-bone-400 text-xs">{s.photoHint}</p>
      {photoError && <p className="text-danger text-sm">{photoError}</p>}

      <Field label={strings.account.displayNameLabel} htmlFor="display-name">
        <TextField
          id="display-name"
          type="text"
          value={value.displayName}
          maxLength={MAX_DISPLAY_NAME}
          onChange={(e) => set({ displayName: e.target.value })}
        />
      </Field>
      {!nameOk && <p className="text-danger text-xs">{strings.account.displayNameEmpty}</p>}

      <Field label={s.countryLabel} htmlFor="profile-country">
        <SearchPicker
          id="profile-country"
          value={value.country}
          onChange={(country) => set({ country })}
          options={countries}
          placeholder={s.countryPlaceholder}
          searchPlaceholder={s.countrySearch}
          emptyLabel={s.countryNone}
          noMatches={s.noMatches}
        />
      </Field>

      <Field label={s.favouriteLabel} htmlFor="profile-favourite">
        <SearchPicker
          id="profile-favourite"
          value={value.favouriteWarbandType}
          onChange={(favouriteWarbandType) => set({ favouriteWarbandType })}
          options={warbandOptions}
          placeholder={s.favouritePlaceholder}
          searchPlaceholder={s.favouriteSearch}
          emptyLabel={s.favouriteNone}
          noMatches={s.noMatches}
        />
      </Field>

      <Field label={s.bioLabel} htmlFor="profile-bio">
        <Textarea
          id="profile-bio"
          value={value.bio}
          maxLength={MAX_BIO}
          placeholder={s.bioPlaceholder}
          onChange={(e) => set({ bio: e.target.value })}
        />
      </Field>
      <p className="text-bone-400 text-xs text-right [font-variant-numeric:tabular-nums_lining-nums]">
        {s.bioCount(value.bio.length, MAX_BIO)}
      </p>

      {dirty && (
        <Button
          disabled={!nameOk || save.isPending}
          onClick={() =>
            save.mutate(
              { ...value, displayName: value.displayName.trim() },
              {
                onSuccess: () => {
                  // Field names only, never what was typed.
                  const fields = (Object.keys(loaded) as (keyof Draft)[]).filter((k) => value[k] !== loaded[k]);
                  void capture('profile_edited', { fields: fields.join(',') });
                  setDraft(null);
                },
              },
            )
          }
        >
          {save.isPending ? strings.common.loading : s.save}
        </Button>
      )}
      {save.isSuccess && !dirty && <p className="text-bone-300 text-xs">{s.saved}</p>}
      {save.isError && <p className="text-danger text-xs">{(save.error as Error).message}</p>}

      {profile && <DirectorySwitches discoverable={profile.discoverable} looking={profile.lookingForCampaign} />}

      <Link to={`/players/${user.id}`} className={buttonClasses('secondary')}>
        {s.view}
      </Link>
    </Card>
  );
}

/**
 * §38.4 — opting in to the directory. Off by default for everyone; saved the
 * moment it's flipped, since it's a single decision rather than a form.
 */
function DirectorySwitches({ discoverable, looking }: { discoverable: boolean; looking: boolean }) {
  const mutation = useSetMyDirectoryMutation();
  const s = strings.profile;
  const set = (next: { discoverable: boolean; looking: boolean }) => mutation.mutate(next);

  return (
    <div id="directory" className="space-y-2 border-t border-ink-800 pt-3 scroll-mt-4">
      <p className="text-bone-100 font-semibold">{s.directoryHeading}</p>
      <Switch
        on={discoverable}
        disabled={mutation.isPending}
        label={s.directoryOn}
        onToggle={() => set({ discoverable: !discoverable, looking: !discoverable && looking })}
      />
      <p className="text-bone-400 text-xs">{s.directoryOnHint}</p>
      <Switch
        on={looking}
        disabled={!discoverable || mutation.isPending}
        label={s.lookingOn}
        onToggle={() => set({ discoverable, looking: !looking })}
      />
      <p className="text-bone-400 text-xs">{s.directoryVisible}</p>
      {mutation.isError && <p className="text-danger text-xs">{(mutation.error as Error).message}</p>}
    </div>
  );
}

export function Switch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="w-full min-h-[48px] flex items-center justify-between gap-3 text-left disabled:opacity-50"
    >
      <span className="text-bone-200">{label}</span>
      <span
        aria-hidden
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors ${
          on ? 'bg-ember-500 border-ember-500' : 'bg-ink-800 border-ink-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bone-100 transition-transform ${
            on ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
