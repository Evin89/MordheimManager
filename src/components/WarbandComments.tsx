import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, SectionHeading, Textarea } from './ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdminQuery } from '../hooks/useIssues';
import {
  useAddWarbandCommentMutation,
  useDeleteWarbandCommentMutation,
  useWarbandCommentsQuery,
} from '../hooks/useWarbandComments';
import { insertIssueReport } from '../api/issues';

/**
 * §19.2 — comments on a shared warband's roster.
 *
 * Reading is signed-in only (the RLS has no anon policy, §11.5), so a signed-out
 * gallery visitor sees a prompt rather than the thread. Anyone signed in may
 * post; the author or an admin may delete (a soft-delete server-side); anyone
 * can Report a comment they didn't write, which files into the same issue_reports
 * inbox the rest of the app uses (§4.9) rather than a second moderation queue.
 */
export default function WarbandComments({ warbandId }: { warbandId: string }) {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdminQuery();
  const location = useLocation();
  const { data: comments } = useWarbandCommentsQuery(user ? warbandId : undefined);
  const addComment = useAddWarbandCommentMutation(warbandId);
  const removeComment = useDeleteWarbandCommentMutation(warbandId);
  const s = strings.comments;

  const [body, setBody] = useState('');
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const canPost = body.trim().length > 0 && !addComment.isPending && !!user;

  function post() {
    if (!canPost || !user) return;
    addComment.mutate(
      { authorId: user.id, body },
      { onSuccess: () => setBody('') },
    );
  }

  async function report(commentId: string, commentBody: string) {
    setError(null);
    try {
      await insertIssueReport({
        reporterId: user?.id ?? null,
        path: location.pathname,
        message: s.reportMessage,
        context: { kind: 'warband_comment', commentId, warbandId, body: commentBody },
        appVersion: __APP_VERSION__,
        userAgent: navigator.userAgent,
      });
      setReported((prev) => new Set(prev).add(commentId));
    } catch {
      setError(s.failed);
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{s.section}</SectionHeading>

      {!user ? (
        <p className="text-bone-300 text-sm">{s.signedOut}</p>
      ) : (
        <>
          <Card gap="sm">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={s.placeholder}
              rows={2}
            />
            <Button size="dense" disabled={!canPost} onClick={post}>
              {addComment.isPending ? s.posting : s.post}
            </Button>
          </Card>

          {(comments?.length ?? 0) === 0 ? (
            <p className="text-bone-300 text-sm">{s.empty}</p>
          ) : (
            <div className="space-y-2">
              {(comments ?? []).map((comment) => {
                const mine = comment.authorId === user.id;
                const canRemove = mine || isAdmin;
                return (
                  <Card key={comment.id} gap="sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-bone-400 text-xs">
                        {s.by(comment.authorDisplayName, new Date(comment.createdAt).toLocaleDateString())}
                      </p>
                      <div className="flex shrink-0 gap-3">
                        {!mine &&
                          (reported.has(comment.id) ? (
                            <span className="text-bone-500 text-xs">{s.reported}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => report(comment.id, comment.body)}
                              className="text-bone-400 text-xs font-semibold hover:text-bone-200"
                            >
                              {s.report}
                            </button>
                          ))}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(s.removeConfirm)) removeComment.mutate(comment.id);
                            }}
                            className="text-blood-500 text-xs font-semibold"
                          >
                            {s.remove}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-bone-200 text-sm whitespace-pre-wrap">{comment.body}</p>
                  </Card>
                );
              })}
            </div>
          )}
          {error && <p className="text-blood-500 text-sm">{error}</p>}
        </>
      )}
    </section>
  );
}
