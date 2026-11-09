import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useStoreLogo } from '../../lib/storeLogo';
import { capture } from '../../lib/posthog';
import { strings } from '../../strings';
import { CampaignPages, RosterPages, SheetCommon, SheetHeading, SheetPreview, SlipData, SlipPages } from './SheetPages';

const S = strings.eventSheet;

/**
 * The blank event sheet (§44.3): the same pages as a filled one, empty. Public
 * and signed-out friendly — it makes no Supabase call at all. A store can add
 * its logo before printing; the logo stays on the device (§43.12).
 */
export default function BlankEventSheetScreen() {
  const storeLogo = useStoreLogo();

  const heading: SheetHeading = { blank: true, title: '', campaign: '', when: '', location: '' };
  const common: SheetCommon = {
    storeLogo: storeLogo.logo,
    storeSlot: !storeLogo.logo,
    houseRules: null,
    underdogOn: true,
    printedLine: S.blankPrinted,
  };
  const emptySlip = (key: string, players: number): SlipData => ({ key, round: null, table: null, scenario: '', sides: [], players });

  function print() {
    capture('resource_print', { resource: 'event-sheet', withStoreLogo: !!storeLogo.logo });
    window.print();
  }

  return (
    <div className="min-h-full">
      <div className="print:hidden px-4 py-4 space-y-3 border-b border-ink-800 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <Link to="/resources" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
            ← {strings.resources.backToResources}
          </Link>
          <Button onClick={print} fullWidth={false}>{S.printAction}</Button>
        </div>
        <p className="text-bone-300 text-sm">{S.printHint}</p>
        <div className="space-y-2">
          <p className="text-bone-100 font-semibold">{S.storeLogo}</p>
          <p className="text-bone-400 text-xs">{S.storeLogoHint}</p>
          <div className="flex gap-2 flex-wrap">
            <label className="min-h-[44px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm inline-flex items-center cursor-pointer">
              {storeLogo.logo ? S.replaceStoreLogo : S.addStoreLogo}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void storeLogo.add(f);
                  e.target.value = '';
                }}
              />
            </label>
            {storeLogo.logo && (
              <button type="button" className="min-h-[44px] px-3 text-bone-400 text-sm" onClick={storeLogo.remove}>
                {S.removeStoreLogo}
              </button>
            )}
          </div>
          {storeLogo.error && <p className="text-danger text-sm">{storeLogo.error}</p>}
        </div>
      </div>

      <div className="py-4 print:p-0">
      <SheetPreview>
        <RosterPages
          heading={heading}
          common={common}
          rows={[]}
          blankRows={26}
          roundCount={3}
          showRecord={false}
          challengeRule={false}
          warbandsCount=""
          pageLabel={() => S.blankRosterCopy}
        />
        <SlipPages
          pages={[[emptySlip('a', 2), emptySlip('b', 2), emptySlip('c', 2)]]}
          heading={heading}
          common={common}
          subtitle=""
          note={S.blankSlips}
          pageLabel={() => S.slipsTitle}
        />
        <SlipPages
          pages={[[emptySlip('m1', 4), emptySlip('m2', 4)]]}
          heading={heading}
          common={common}
          subtitle=""
          note={S.blankMultiSlips}
          pageLabel={() => S.slipsMultiTitle}
        />
        <CampaignPages
          heading={heading}
          common={common}
          standings={Array.from({ length: 20 }, () => ({ rank: null, name: '', player: '', w: null, l: null, d: null, rating: null }))}
          territories={Array.from({ length: 5 }, () => ({ name: '', heldBy: '' }))}
          subtitle=""
          pageLabel={() => S.campaignTitle}
        />
      </SheetPreview>
      </div>
    </div>
  );
}
