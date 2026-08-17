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
import { useEventRsvpsQuery, useSetRsvpMutation } from '../hooks/useRsvps';
import { RsvpStatus } from '../api/rsvps';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button, Card, SectionHeading, Field, TextField, Textarea } from '../components/ui';

/**
 * §19.1 — Going / Maybe / Can't for one game night.
 *
 * Tapping the option you already chose withdraws it, so the row doubles as its
 * own "un-RSVP". Names come from the campaign member list the screen already
 * loaded rather than a per-row profile join. Anyone who can see the event sees
 * the tally; only members can add their own row (the 0019 policy decides).
 */
function RsvpSection({
  eventId,
  members,
  userId,
}: {
  eventId: string;
  members: { userId: string; displayName: string }[];
  userId: string | undefined;
}) {
  const { data: rsvps } = useEventRsvpsQuery(eventId);
  const setRsvp = useSetRsvpMutation(eventId);
  const mine = rsvps?.find((r) => r.userId === userId)?.status ?? null;
  const nameOf = (id: string) =>
    members.find((m) => m.userId === id)?.displayName || strings.campaign.unknownWarband;

  const options: { value: RsvpStatus; label: string }[] = [
    { value: 'going', label: strings.events.rsvp.going },
    { value: 'maybe', label: strings.events.rsvp.maybe },
    { value: 'cant', label: strings.events.rsvp.cant },
  ];

  const byStatus = (status: RsvpStatus) => (rsvps ?? []).filter((r) => r.status === status);

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.events.rsvp.heading}</SectionHeading>

      <div className="flex gap-2">
        {options.map((o) => {
          const active = mine === o.value;
          return (
            <Button
              key={o.value}
              variant={active ? 'primary' : 'secondary'}
              size="dense"
              fullWidth={false}
              onClick={() => setRsvp(active ? null : o.value)}
              className="flex-1"
            >
              {o.label}
            </Button>
          );
        })}
      </div>

      {(rsvps?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{strings.events.rsvp.noneYet}</p>
      ) : (
        <div className="space-y-2">
          {options.map((o) => {
            const people = byStatus(o.value);
            if (people.length === 0) return null;
            return (
              <div key={o.value} className="text-sm">
                <span className="text-bone-400">{o.label}: </span>
                <span className="text-bone-200">{people.map((r) => nameOf(r.userId)).join(', ')}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

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
            <Card as="section" gap="sm">
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
            </Card>

            <RsvpSection eventId={event.id} members={members ?? []} userId={user?.id} />

            {event.notes && (
              <section className="space-y-2">
                <SectionHeading>{strings.events.notesLabel}</SectionHeading>
                <p className="text-bone-300 whitespace-pre-line">{event.notes}</p>
              </section>
            )}

            {canEdit && !confirmingDelete && (
              <div className="space-y-2">
                <Button variant="secondary" onClick={startEditing}>
                  {strings.events.editButton}
                </Button>
                <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                  {strings.events.deleteButton}
                </Button>
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
          <Card as="section">
            <Field label={strings.events.titleLabel} htmlFor="edit-title">
              <TextField
                id="edit-title"
                type="text"
                value={draft?.title ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              />
            </Field>

            <Field label={strings.events.whenLabel} htmlFor="edit-when">
              <TextField
                id="edit-when"
                type="datetime-local"
                value={draft?.when ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, when: e.target.value } : d))}
              />
            </Field>

            <Field label={strings.events.locationLabel} htmlFor="edit-where">
              <TextField
                id="edit-where"
                type="text"
                value={draft?.location ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, location: e.target.value } : d))}
              />
            </Field>

            <Field label={strings.events.notesLabel} htmlFor="edit-notes">
              <Textarea
                id="edit-notes"
                rows={3}
                value={draft?.notes ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
              />
            </Field>

            {error && <p className="text-blood-500 text-sm">{error}</p>}

            <Button
              disabled={!draft?.title.trim() || !draft?.when || saving}
              onClick={save}
            >
              {saving ? strings.common.loading : strings.common.save}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
            >
              {strings.common.cancel}
            </button>
          </Card>
        )}
      </main>
    </div>
  );
}
