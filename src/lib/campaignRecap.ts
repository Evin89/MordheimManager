import { StandingsRow } from '../types';
import { CampaignAward } from './awards';

/**
 * Renders a campaign's final recap to a shareable image — the same canvas
 * approach as the warband card (dependency-free, self-hosted fonts, the app's
 * own dark palette). Shows the champion, the final standings and the honours,
 * sized to drop into a Discord/WhatsApp message when a season wraps.
 */

const W = 1200;
const PAD = 72;

const C = {
  page: '#0b0a09',
  raised: '#141210',
  line: '#2b2724',
  ink: '#f2ead9',
  inkDim: '#d8c6a1',
  inkFaint: '#a8987a',
  ember: '#dc5c0e',
  emberBright: '#f2751a',
};

/** Best record first: wins, then draws, then fewer losses, then rating. */
export function rankStandings(standings: StandingsRow[]): StandingsRow[] {
  return [...standings]
    .filter((r) => r.warbandName)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.draws - a.draws ||
        a.losses - b.losses ||
        (b.rating ?? 0) - (a.rating ?? 0),
    );
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load("72px 'Pirata One'"),
      document.fonts.load("400 30px 'IM Fell English'"),
      document.fonts.load("600 24px 'Alegreya Sans'"),
      document.fonts.load("700 26px 'Alegreya Sans'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* system fallback — off-brand but legible */
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

export async function renderCampaignRecap(
  campaignName: string,
  standings: StandingsRow[],
  awards: CampaignAward[],
): Promise<Blob> {
  await ensureFonts();
  const ranked = rankStandings(standings).slice(0, 8);
  const champion = ranked[0];

  const headerH = 300;
  const champH = champion ? 96 : 0;
  const standingsH = 56 + ranked.length * 44;
  const awardsH = awards.length > 0 ? 56 + awards.length * 40 : 0;
  const footerH = 110;
  const H = headerH + champH + standingsH + awardsH + footerH;

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // Header
  let y = PAD + 8;
  ctx.fillStyle = C.ember;
  ctx.font = "600 24px 'Alegreya Sans', sans-serif";
  ctx.fillText('M O R D H E I M   M A N A G E R   ·   C A M P A I G N   R E C A P', PAD, y);
  y += 66;
  ctx.fillStyle = C.ink;
  ctx.font = "72px 'Pirata One', Georgia, serif";
  ctx.fillText(fit(ctx, campaignName, W - PAD * 2), PAD, y + 56);
  y = headerH;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 34);
  ctx.lineTo(W - PAD, y - 34);
  ctx.stroke();

  // Champion
  if (champion) {
    ctx.fillStyle = C.emberBright;
    ctx.font = "600 22px 'Alegreya Sans', sans-serif";
    ctx.fillText('CHAMPION', PAD, y + 20);
    ctx.fillStyle = C.ink;
    ctx.font = "400 40px 'IM Fell English', Georgia, serif";
    ctx.fillText(fit(ctx, champion.warbandName ?? '', W - PAD * 2 - 260), PAD, y + 62);
    ctx.fillStyle = C.inkFaint;
    ctx.font = "24px 'Alegreya Sans', sans-serif";
    const rec = `${champion.wins}–${champion.losses}–${champion.draws}`;
    ctx.fillText(rec, W - PAD - ctx.measureText(rec).width, y + 56);
    y += champH;
  }

  // Final standings
  ctx.fillStyle = C.ember;
  ctx.font = "600 22px 'Alegreya Sans', sans-serif";
  ctx.fillText('FINAL STANDINGS', PAD, y + 24);
  y += 56;
  ranked.forEach((row, i) => {
    ctx.fillStyle = C.inkFaint;
    ctx.font = "700 24px 'Alegreya Sans', sans-serif";
    ctx.fillText(`${i + 1}.`, PAD, y + 24);
    ctx.fillStyle = C.ink;
    ctx.font = "400 28px 'IM Fell English', Georgia, serif";
    ctx.fillText(fit(ctx, row.warbandName ?? '', W - PAD * 2 - 320), PAD + 44, y + 24);
    ctx.fillStyle = C.inkFaint;
    ctx.font = "24px 'Alegreya Sans', sans-serif";
    const rec = `${row.wins}–${row.losses}–${row.draws}   ·   ${row.playerName}`;
    ctx.fillText(fit(ctx, rec, 300), W - PAD - Math.min(300, ctx.measureText(rec).width), y + 24);
    y += 44;
  });

  // Honours
  if (awards.length > 0) {
    y += 12;
    ctx.fillStyle = C.ember;
    ctx.font = "600 22px 'Alegreya Sans', sans-serif";
    ctx.fillText('HONOURS', PAD, y + 24);
    y += 56 - 12;
    for (const a of awards) {
      ctx.fillStyle = C.inkDim;
      ctx.font = "600 24px 'Alegreya Sans', sans-serif";
      ctx.fillText(fit(ctx, a.title, 360), PAD, y + 22);
      ctx.fillStyle = C.ink;
      ctx.font = "24px 'Alegreya Sans', sans-serif";
      ctx.fillText(fit(ctx, `${a.holderWarbandName} — ${a.value}`, W - PAD * 2 - 380), PAD + 380, y + 22);
      y += 40;
    }
  }

  // Footer
  const fy = H - footerH + 44;
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 30);
  ctx.lineTo(W - PAD, fy - 30);
  ctx.stroke();
  ctx.fillStyle = C.ember;
  ctx.font = "600 26px 'Alegreya Sans', sans-serif";
  const site = 'mordheimmanager.net';
  ctx.fillText(site, W - PAD - ctx.measureText(site).width, fy);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode recap.'))), 'image/png');
  });
}
