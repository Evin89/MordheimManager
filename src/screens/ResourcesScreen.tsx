import { Link } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { Card, buttonClasses } from '../components/ui';
import { capture } from '../lib/posthog';
import { strings } from '../strings';

const R = strings.resources;

type Resource = {
  id: 'event-sheet' | 'roster';
  title: string;
  description: string;
  route: string;
  thumb: string;
  pdfA4: string;
  pdfLetter: string;
};

/*
 * The PDFs are exported by hand from the blank print routes with the browser's
 * Save as PDF and committed to public/downloads (§44.3) — no PDF library or
 * headless browser in the build. Re-export them whenever a sheet's layout
 * changes (deploy checklist, §27.3).
 */
const RESOURCES: Resource[] = [
  {
    id: 'event-sheet',
    title: R.eventSheetTitle,
    description: R.eventSheetDescription,
    route: '/resources/event-sheet',
    thumb: '/downloads/mordheim-manager-event-sheet.png',
    pdfA4: '/downloads/mordheim-manager-event-sheet-a4.pdf',
    pdfLetter: '/downloads/mordheim-manager-event-sheet-letter.pdf',
  },
  {
    id: 'roster',
    title: R.rosterTitle,
    description: R.rosterDescription,
    route: '/resources/roster',
    thumb: '/downloads/mordheim-manager-roster.png',
    pdfA4: '/downloads/mordheim-manager-roster-a4.pdf',
    pdfLetter: '/downloads/mordheim-manager-roster-letter.pdf',
  },
];

/**
 * §44 — blank sheets anyone can print. Public, like the rules: a printout lying
 * on a table in a games store is how people find the app.
 */
export default function ResourcesScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={R.title} />
      <main className="flex-1 px-4 py-4 space-y-4 max-w-3xl w-full mx-auto">
        <p className="text-bone-300">{R.intro}</p>
        {RESOURCES.map((r) => (
          <Card key={r.id} as="section">
            <div className="flex gap-4 items-start">
              <img
                src={r.thumb}
                alt=""
                className="w-20 h-28 object-cover object-top bg-white rounded-sm border border-ink-700 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="space-y-1 min-w-0">
                <h2 className="text-bone-100 font-semibold text-lg">{r.title}</h2>
                <p className="text-bone-300 text-sm">{r.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={r.pdfA4}
                download
                className={buttonClasses('primary')}
                onClick={() => capture('resource_download', { resource: r.id, paper: 'a4' })}
              >
                {R.downloadA4}
              </a>
              <a
                href={r.pdfLetter}
                download
                className={buttonClasses('secondary')}
                onClick={() => capture('resource_download', { resource: r.id, paper: 'letter' })}
              >
                {R.downloadLetter}
              </a>
              <Link to={r.route} className={buttonClasses('secondary')}>
                {r.id === 'event-sheet' ? R.customise : R.printOpen}
              </Link>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}
