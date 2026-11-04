/**
 * Opening the guided nav tour (§20.4) from anywhere. The floating ? button is
 * gone (§40.2); Help & about asks for the tour with this event, and NavTour,
 * mounted once in the shell, listens for it.
 */
export const OPEN_TOUR_EVENT = 'mordheim:open-tour';

export function openNavTour(): void {
  window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
}
