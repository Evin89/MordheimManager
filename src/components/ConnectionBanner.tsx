import { useConnectionStatus } from '../store/useConnectionStatus';
import { strings } from '../strings';

export default function ConnectionBanner() {
  const lastError = useConnectionStatus((s) => s.lastError);
  const clear = useConnectionStatus((s) => s.clear);

  if (!lastError) return null;

  return (
    <div className="print:hidden sticky top-0 z-50 bg-blood-600 text-bone-100 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <span>{strings.connection.lost}</span>
      <button type="button" onClick={clear} className="shrink-0 font-semibold underline">
        {strings.common.dismiss}
      </button>
    </div>
  );
}
