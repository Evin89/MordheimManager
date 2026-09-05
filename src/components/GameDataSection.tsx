import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, SectionHeading, Textarea } from './ui';
import RuleDisclosure from './RuleDisclosure';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { DATA_FILES, dataVersions } from '../lib/dataFiles';
import { insertIssueReport } from '../api/issues';

/**
 * §4.6 — the bundled game data, with each file's schema version and the rulebook
 * source it came from (a disclosure per file), plus a "report a data error" form
 * that files into the same `issue_reports` inbox as the rest of the app — with
 * the data versions attached, so an admin sees exactly what the reporter was
 * running. Presentation over data the files already carry, not new plumbing.
 */
export default function GameDataSection() {
  const { user } = useAuth();
  const location = useLocation();
  const s = strings.settings.gameData;
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function report() {
    if (body.trim().length === 0 || state === 'sending') return;
    setState('sending');
    try {
      await insertIssueReport({
        reporterId: user?.id ?? null,
        path: location.pathname,
        message: body.trim(),
        context: { kind: 'data_error', dataVersions: dataVersions() },
        appVersion: __APP_VERSION__,
        userAgent: navigator.userAgent,
      });
      setBody('');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <Card as="section">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-sm">{s.hint}</p>

      <div className="rounded-md bg-ink-900 border border-ink-800 px-3">
        {DATA_FILES.map((file) => (
          <RuleDisclosure key={file.name} name={s.fileLabel(file.name, file.version)} text={file.source} />
        ))}
      </div>

      <div className="space-y-2 pt-1">
        <p className="text-bone-200 text-sm font-semibold">{s.reportHeading}</p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={s.reportPlaceholder}
          rows={2}
        />
        <Button size="dense" disabled={body.trim().length === 0 || state === 'sending'} onClick={report}>
          {state === 'sending' ? strings.report.sending : s.reportButton}
        </Button>
        {state === 'sent' && <p className="text-verdigris text-sm">{strings.report.thanks}</p>}
        {state === 'error' && <p className="text-blood-500 text-sm">{strings.report.failed}</p>}
      </div>
    </Card>
  );
}
