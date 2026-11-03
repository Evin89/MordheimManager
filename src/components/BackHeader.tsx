import { useLocation, useNavigate } from 'react-router-dom';
import { strings } from '../strings';
import { isFirstEntry, parentPath } from '../lib/backNavigation';

type BackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** A control on the right, e.g. the roster's Share button (§37.1). */
  action?: React.ReactNode;
  /** Under the title row: the screen's `SubTabs`, as in `TabHeader` (§40.3). */
  children?: React.ReactNode;
};

export default function BackHeader({ title, subtitle, onBack, action, children }: BackHeaderProps) {
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
    <header className="px-4 pt-6 pb-4 border-b border-ink-800 space-y-4">
      <div className="flex items-start gap-3">
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
      </div>
      {children}
    </header>
  );
}
