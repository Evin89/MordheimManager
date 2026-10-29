import { useLocation, useNavigate } from 'react-router-dom';
import { strings } from '../strings';
import { isFirstEntry, parentPath } from '../lib/backNavigation';

type BackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** A control on the right, e.g. the roster's Share button (§37.1). */
  action?: React.ReactNode;
};

export default function BackHeader({ title, subtitle, onBack, action }: BackHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function goBack() {
    if (onBack) return onBack();
    // Opened cold (shared link, bookmark, restored tab): history.back() would
    // leave the app, so go to this screen's parent instead (lib/backNavigation).
    if (isFirstEntry(location.key)) return navigate(parentPath(location.pathname), { replace: true });
    navigate(-1);
  }

  return (
    // With an action, the right gutter clears the floating help and dice
    // buttons (fixed top-right), which would otherwise sit on top of it.
    <header
      className={`px-4 pt-6 pb-4 border-b border-ink-800 flex items-start gap-3 ${action ? 'pr-14 md:pr-16' : ''}`}
    >
      <button
        type="button"
        onClick={goBack}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-bone-300 hover:text-bone-100 text-xl shrink-0"
        aria-label={strings.common.back}
      >
        ←
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide truncate">{title}</h1>
        {subtitle && <p className="text-bone-300 text-sm mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
