import { useNavigate } from 'react-router-dom';
import { strings } from '../strings';

type BackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export default function BackHeader({ title, subtitle, onBack }: BackHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="px-4 pt-6 pb-4 border-b border-ink-800 flex items-start gap-3">
      <button
        type="button"
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-bone-300 hover:text-bone-100 text-xl shrink-0"
        aria-label={strings.common.back}
      >
        ←
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-bone-100 tracking-wide truncate">{title}</h1>
        {subtitle && <p className="text-bone-300 text-sm mt-0.5 truncate">{subtitle}</p>}
      </div>
    </header>
  );
}
