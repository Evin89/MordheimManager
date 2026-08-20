import { Warband } from '../types';
import { computeWarbandRating, isInWarband } from './rating';
import { modelDisplayName } from './modelNames';
import { getWarbandTypeName } from '../data/warbandRegistry';

/**
 * Renders a warband to a shareable card image, drawn straight onto a canvas —
 * the same dependency-free approach the photo pipeline uses, and for the same
 * reason (no image/DOM-to-canvas library, and full control over the fonts).
 *
 * The card is the app's own dark palette and type, sized 1200px wide with a
 * height that grows to fit the roster, so it drops cleanly into a Discord/WhatsApp
 * message. Colours are the Grimdark hexes hard-coded here because a canvas can't
 * read the CSS variables; they mirror `src/index.css`.
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

type Row = { name: string; sub: string; right: string };
type Group = { title: string; rows: Row[] };

function rosterGroups(warband: Warband): Group[] {
  const groups: Group[] = [];

  const heroes = warband.heroes.filter((h) => isInWarband(h.status));
  if (heroes.length > 0) {
    groups.push({
      title: 'Heroes',
      rows: heroes.map((h) => ({
        name: modelDisplayName(h),
        sub: h.unitType,
        right: `${h.xp} XP`,
      })),
    });
  }

  if (warband.henchmenGroups.length > 0) {
    groups.push({
      title: 'Henchmen',
      rows: warband.henchmenGroups.map((g) => ({
        name: g.groupName,
        sub: `${g.count}× ${g.unitType}`,
        right: `${g.xp} XP`,
      })),
    });
  }

  const swords = warband.hiredSwords.filter((s) => isInWarband(s.status));
  if (swords.length > 0) {
    groups.push({
      title: 'Hired Swords',
      rows: swords.map((s) => ({ name: modelDisplayName(s), sub: s.type, right: `${s.xp} XP` })),
    });
  }

  return groups;
}

/** Loads the warband photo without tainting the canvas — fetched as bytes and
 * handed back through a blob URL (same-origin), so `toBlob` still works. Any
 * failure (CORS, network, no photo) resolves to null and the card omits it. */
async function loadPhoto(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return img;
  } catch {
    return null;
  }
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load("72px 'Pirata One'"),
      document.fonts.load("400 34px 'IM Fell English'"),
      document.fonts.load("600 26px 'Alegreya Sans'"),
      document.fonts.load("700 26px 'Alegreya Sans'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* If font loading is unavailable, the canvas falls back to a system serif —
       still legible, just off-brand. Not worth failing the export over. */
  }
}

/** Truncates to fit `max` px in the current context font, adding an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

export async function renderWarbandCard(
  warband: Warband,
  photoUrl?: string,
): Promise<Blob> {
  await ensureFonts();
  const photo = await loadPhoto(photoUrl);

  const groups = rosterGroups(warband);
  const rating = computeWarbandRating(warband);
  const typeName = getWarbandTypeName(warband.warbandType);

  // --- Measure: header block, then each group (title + rows). ---
  // The header draws the rating badge at baseline ~298; the divider sits 30px
  // above headerH, so headerH must clear that baseline with margin (360 with a
  // photo, and no less than ~344 without — 300 put the divider through the
  // rating text).
  const headerH = photo ? 360 : 348;
  const groupTitleH = 64;
  const rowH = 52;
  const bodyH = groups.reduce((sum, g) => sum + groupTitleH + g.rows.length * rowH, 0);
  const footerH = 120;
  const H = headerH + bodyH + footerH;

  const canvas = document.createElement('canvas');
  const scale = 2; // retina-crisp
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.scale(scale, scale);

  // Background + inset frame.
  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // --- Header ---
  let y = PAD + 8;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = C.ember;
  ctx.font = "600 24px 'Alegreya Sans', sans-serif";
  ctx.fillText('M O R D H E I M   M A N A G E R', PAD, y);
  y += 60;

  if (photo) {
    // A banner strip of the photo, cover-fit into a fixed box on the right.
    const boxW = 320;
    const boxH = 200;
    const bx = W - PAD - boxW;
    const by = y - 20;
    const ratio = Math.max(boxW / photo.width, boxH / photo.height);
    const dw = photo.width * ratio;
    const dh = photo.height * ratio;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, boxW, boxH);
    ctx.clip();
    ctx.drawImage(photo, bx + (boxW - dw) / 2, by + (boxH - dh) / 2, dw, dh);
    ctx.restore();
    ctx.strokeStyle = C.line;
    ctx.strokeRect(bx, by, boxW, boxH);
  }

  const nameMax = (photo ? W - PAD * 2 - 360 : W - PAD * 2);
  ctx.fillStyle = C.ink;
  ctx.font = "72px 'Pirata One', Georgia, serif";
  ctx.fillText(fit(ctx, warband.name, nameMax), PAD, y + 56);
  y += 96;

  ctx.fillStyle = C.inkDim;
  ctx.font = "34px 'IM Fell English', Georgia, serif";
  ctx.fillText(fit(ctx, typeName, nameMax), PAD, y + 20);
  y += 56;

  // Rating badge.
  ctx.fillStyle = C.emberBright;
  ctx.font = "700 30px 'Alegreya Sans', sans-serif";
  ctx.fillText(`Rating ${rating}`, PAD, y + 6);
  y = headerH;

  // Divider under the header.
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 30);
  ctx.lineTo(W - PAD, y - 30);
  ctx.stroke();

  // --- Roster ---
  for (const g of groups) {
    ctx.fillStyle = C.ember;
    ctx.font = "600 22px 'Alegreya Sans', sans-serif";
    ctx.fillText(g.title.toUpperCase(), PAD, y + 22);
    y += groupTitleH;

    for (const row of g.rows) {
      // Right column (XP) first, so the name knows how much room it has.
      ctx.fillStyle = C.inkFaint;
      ctx.font = "26px 'Alegreya Sans', sans-serif";
      const rightW = ctx.measureText(row.right).width;
      ctx.fillText(row.right, W - PAD - rightW, y + 24);

      ctx.fillStyle = C.ink;
      ctx.font = "400 30px 'IM Fell English', Georgia, serif";
      const nameText = fit(ctx, row.name, W - PAD * 2 - rightW - 260);
      const nameW = ctx.measureText(nameText).width;
      ctx.fillText(nameText, PAD, y + 24);

      ctx.fillStyle = C.inkFaint;
      ctx.font = "24px 'Alegreya Sans', sans-serif";
      ctx.fillText(fit(ctx, row.sub, W - PAD * 2 - rightW - nameW - 40), PAD + nameW + 16, y + 22);

      y += rowH;
    }
  }

  // --- Footer ---
  const fy = H - footerH + 44;
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 34);
  ctx.lineTo(W - PAD, fy - 34);
  ctx.stroke();

  ctx.fillStyle = C.inkDim;
  ctx.font = "26px 'Alegreya Sans', sans-serif";
  ctx.fillText(`${warband.gold} gc · ${warband.wyrdstoneShards} wyrdstone shards`, PAD, fy);

  ctx.fillStyle = C.ember;
  ctx.font = "600 26px 'Alegreya Sans', sans-serif";
  const site = 'mordheimmanager.net';
  ctx.fillText(site, W - PAD - ctx.measureText(site).width, fy);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode card.'))), 'image/png');
  });
}
