-- 0071_issue_report_slack_notify.sql
-- MM-020: post every new issue report to Slack.
--
-- Reuses the 0031 poster public.notify_slack(secret, text): Vault-backed,
-- async via pg_net, never raises. The webhook URL lives in Vault as
-- `slack_issues_webhook` (operator setup, not in this migration); while the
-- secret is absent the trigger is a no-op.
--
-- Privacy: the message carries the report text (truncated), the path and the
-- build. It never carries reporter_id or user_agent (MM-020 design).
--
-- Chosen over the earlier DB webhook -> Edge Function design for the same
-- reason as §23.9: fewer moving parts, same layer as the signup alerts.

create or replace function public.on_issue_report_notify_slack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_text text;
begin
  begin
    v_body := coalesce(new.message, '');
    if length(v_body) > 200 then
      v_body := left(v_body, 200) || '…';
    end if;

    -- Slack mrkdwn escaping
    v_body := replace(replace(replace(v_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

    v_text := '🐛 Nieuw issue gemeld' || E'\n'
           || '> ' || replace(v_body, E'\n', E'\n> ') || E'\n'
           || 'Pad: `' || coalesce(new.path, '?') || '` · versie '
           || coalesce(new.app_version, '?');

    perform public.notify_slack('slack_issues_webhook', v_text);
  exception when others then
    -- Never let Slack block or fail an issue report.
    raise notice 'Issue Slack notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.on_issue_report_notify_slack() from public, anon, authenticated;

drop trigger if exists on_issue_report_notify_slack on public.issue_reports;
create trigger on_issue_report_notify_slack
  after insert on public.issue_reports
  for each row execute function public.on_issue_report_notify_slack();
