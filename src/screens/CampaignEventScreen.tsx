import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ConfirmByTyping from '../components/ConfirmByTyping';
import {
  useCampaignEventsQuery,
  useDeleteEventMutation,
  useUpdateEventMutation,
} from '../hooks/useEvents';
import { useCampaignMembersQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';

/** `datetime-local` wants local wall-clock `YYYY-MM-DDTHH:mm`, not an ISO
 * instant. Building it from local parts keeps the value the user originally
 * picked; going through toISOString would shift it by the UTC offset every
 * time the form was opened. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * One game night.
 *
 * The list and the calendar both show enough to recognise an event; this is
 * where you read the notes in full and change the details. Editing lives here
 * rather than in the list because `campaign_events_update` has been in the
 * schema since 0001 with nothing calling it — moving a game to a different
 * evening meant deleting it and typing it again.
 */
export default function CampaignEventScreen() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: campaign, isLoading: campaignLoading } = useMyCampaignQuery();
  const { data: events, isLoading: eventsLoading } = useCampaignEventsQuery(campaign?.id);
  const { data: members } = useCampaignMembersQuery(campaign?.id);
  const saveEvent = useUpdateEventMutation(campaign?.id);
  const deleteEvent = useDeleteEventMutation(campaign?.id);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    when: string;
    location: string;
    notes: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (campaignLoading || eventsLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  if (!campaign) return <Navigate to="/campaigns" replace />;

  const event = events?.find((e) => e.id === eventId);
  // A deleted event, or a link from another campaign. The list is a more
  // useful landing place than an error.
  if (!event) return <Navigate to="/campaign/events" replace />;

  const isLeader = (members ?? []).some(
    (m) => m.userId === user?.id && m.role === 'campaign_leader',
  );
  // The policy is what actually decides; this only chooses whether to render
  // the controls, so a wrong guess shows a button that fails rather than
  // granting anything.
  const canEdit = event.createdBy === user?.id || isLeader;
  const organiser = (members ?? []).find((m) => m.userId === event.createdBy)?.displayName;

  function startEditing() {
    if (!event) return;
    setDraft({
      title: event.title,
      when: toLocalInput(event.eventDateTime),
      location: event.location ?? '',
      notes: event.notes ?? '',
    });
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!draft || !event) return;
    setSaving(true);
    const message = await saveEvent(event.id, {
      title: draft.title,
      eventDateTime: new Date(draft.when).toISOString(),
      location: draft.location,
      notes: draft.notes,
    });
    setSaving(false);
    setError(message);
    if (!message) setEditing(false);
  }

  const when = new Date(event.eventDateTime);
  const isPast = when.getTime() < Date.now();

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={event.title} subtitle={campaign.name} />

      <main className="flex-1 px-4 py-4 space-y-6">
        {!editing ? (
          <>
            <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
              <p className="text-bone-100 font-semibold">
                {when.toLocaleString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {isPast && <p className="text-bone-400 text-sm">{strings.events.alreadyHappened}</p>}
              {event.location && <p className="text-bone-300">{event.location}</p>}
              {organiser && (
                <p className="text-bone-400 text-sm">{strings.events.organisedBy(organiser)}</p>
              )}
            </section>

            {event.notes && (
              <section className="space-y-2">
                <h2 className="text-bone-100 font-semibold">{strings.events.notesLabel}</h2>
                <p className="text-bone-300 whitespace-pre-line">{event.notes}</p>
              </section>
            )}

            {canEdit && !confirmingDelete && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={startEditing}
                  className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 transition-colors"
                >
                  {strings.events.editButton}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full min-h-[48px] rounded-md border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors"
                >
                  {strings.events.deleteButton}
                </button>
              </div>
            )}

            {canEdit && confirmingDelete && (
              <div className="space-y-2">
                <ConfirmByTyping
                  phrase={event.title}
                  label={strings.events.deleteTypeLabel(event.title)}
                  action={strings.events.deleteButton}
                  onConfirm={() => {
                    deleteEvent(event.id);
                    navigate('/campaign/events', { replace: true });
                  }}
                  impact={<p>{strings.events.deleteImpact}</p>}
                />
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
                >
                  {strings.common.cancel}
                </button>
              </div>
            )}
          </>
        ) : (
          <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <div className="space-y-1">
              <label htmlFor="edit-title" className="block text-bone-300 text-sm">
                {strings.events.titleLabel}
              </label>
              <input
                id="edit-title"
                type="text"
                value={draft?.title ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-when" className="block text-bone-300 text-sm">
                {strings.events.whenLabel}
              </label>
              <input
                id="edit-when"
                type="datetime-local"
                value={draft?.when ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, when: e.target.value } : d))}
                className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-where" className="block text-bone-300 text-sm">
                {strings.events.locationLabel}
              </label>
              <input
                id="edit-where"
                type="text"
                value={draft?.location ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-notes" className="block text-bone-300 text-sm">
                {strings.events.notesLabel}
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={draft?.notes ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                className="w-full rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
              />
            </div>

            {error && <p className="text-blood-500 text-sm">{error}</p>}

            <button
              type="button"
              disabled={!draft?.title.trim() || !draft?.when || saving}
              onClick={save}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 disabled:opacity-50 text-ink-950 font-semibold transition-colors"
            >
              {saving ? strings.common.loading : strings.common.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
            >
              {strings.common.cancel}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
