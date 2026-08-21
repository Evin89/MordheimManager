import { Navigate, NavLink, Outlet } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import { useIsAdminQuery } from '../../hooks/useIssues';
import { strings } from '../../strings';

/**
 * §4.9.1 — the shared admin shell: the gate once, a tab strip, and an <Outlet>
 * for the sub-screens. The gate is the `is_admin()` function check (the URL was
 * never the protection), so a non-admin who deep-links a sub-route still lands
 * here and is redirected. A tab strip, not a second left rail — the app's main
 * nav is already a rail, and rail-on-rail is the thing to avoid.
 */
const TABS = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/issues', label: 'Issues' },
  { to: '/admin/players', label: 'Players' },
  { to: '/admin/campaigns', label: 'Campaigns' },
  { to: '/admin/maintenance', label: 'Maintenance' },
];

export default function AdminLayout() {
  const { data: isAdmin, isPending } = useIsAdminQuery();

  if (isPending) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-400">{strings.common.loading}</p>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title="Admin" />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `min-h-[40px] px-3 rounded-md border font-ui text-sm font-semibold whitespace-nowrap flex items-center ${
                isActive ? 'bg-ember-500 text-on-accent border-ember-500' : 'border-ink-700 text-bone-200'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
