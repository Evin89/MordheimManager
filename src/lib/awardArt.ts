/**
 * Badge art for the computed §17.4 campaign awards, keyed by the award id that
 * `computeAwards` (src/lib/awards.ts) assigns. Optional per award — an id with
 * no entry here renders as the plain text card it always was, so designs can
 * land one at a time.
 *
 * Files live in `public/awards/` and are served from the site root (like
 * `/banner/…`). The map is explicit id → path: the design filenames don't have
 * to match the ids (they don't), and either `.svg` (crisp at any size) or `.png`
 * works. To add one: drop the art in that folder and point its award id at it.
 */
export const AWARD_ART: Record<string, string> = {
  'most-battles': '/awards/award_most_battles.png',
  'most-wyrdstone': '/awards/award_most_wyrdstone_found.png',
  'longest-streak': '/awards/award_longest_winning_streak.png',
  'highest-rating': '/awards/award_highest_ranking.png',
  'most-models-lost': '/awards/award_most_models_lost.png',
  'most-killed': '/awards/award_most_killed.png',
};
