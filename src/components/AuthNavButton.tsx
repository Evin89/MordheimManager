import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { SignInIcon, SignOutIcon } from './navItems';

/**
 * The sign in / sign out control that lives at the end of both navs.
 *
 * It's a `<button>` rather than a `NavLink` because signing out is an action,
 * not a destination — and when signed out it navigates to /login carrying the
 * current path, so you land back where you were after signing in.
 *
 * `variant` matches the surrounding nav's own item styling: `bar` for the
 * mobile bottom bar, `rail` for the tablet/desktop sidebar.
 */
export default function AuthNavButton({ variant }: { variant: 'bar' | 'rail' }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't flash "Sign in" while the session is still being restored.
  if (loading) return null;

  const signedIn = !!user;
  const label = signedIn ? strings.nav.signOut : strings.nav.signIn;
  const Icon = signedIn ? SignOutIcon : SignInIcon;

  async function handleClick() {
    if (signedIn) {
      await signOut();
      // Land somewhere that's readable signed out, rather than sitting on a
      // now-forbidden screen waiting to be redirected.
      navigate('/', { replace: true });
    } else {
      navigate('/login', { state: { from: location.pathname } });
    }
  }

  if (variant === 'bar') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={label}
        className="flex-1 min-w-0 min-h-[56px] flex items-center justify-center text-center text-[11px] font-semibold leading-tight px-0.5 truncate transition-colors border-l border-ink-800 text-bone-300 hover:text-bone-100"
      >
        <Icon className="h-5 w-5 sm:hidden" />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      className="w-[calc(100%-1rem)] flex items-center gap-3 h-11 mx-2 my-0.5 rounded-md justify-center lg:justify-start lg:px-3 transition-colors text-bone-300 hover:text-bone-100 hover:bg-ink-800/60"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden lg:inline text-sm font-semibold">{label}</span>
    </button>
  );
}
