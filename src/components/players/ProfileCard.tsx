import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { MAX_DISPLAY_NAME } from '../../api/profile';
import { MAX_BIO } from '../../api/players';
import {
  useAvatarMutations,
  useAvatarUrls,
  usePlayerProfileQuery,
  useUpdateMyProfileMutation,
} from '../../hooks/usePlayers';
import { countryOptions } from '../../lib/countries';
import { builtInWarbandNames } from '../../data/warbandNames';
import { strings } from '../../strings';
import { capture } from '../../lib/posthog';
import { Button, Card, Field, SectionHeading, TextField, Textarea, buttonClasses } from '../ui';
import PlayerAvatar from './PlayerAvatar';
import SearchPicker from './SearchPicker';

type Draft = { displayName: string; bio: string; favouriteWarbandType: string; country: string };

/**
 * §38 — the Account screen's Profile card (amends §4.6).
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
      <SectionHeading>{s.cardTitle}</SectionHeading>
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

      <Field label={strings.settings.displayNameLabel} htmlFor="display-name">
        <TextField
          id="display-name"
          type="text"
          value={value.displayName}
          maxLength={MAX_DISPLAY_NAME}
          onChange={(e) => set({ displayName: e.target.value })}
        />
      </Field>
      {!nameOk && <p className="text-danger text-xs">{strings.settings.displayNameEmpty}</p>}

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

      <Link to={`/players/${user.id}`} className={buttonClasses('secondary')}>
        {s.view}
      </Link>
    </Card>
  );
}
