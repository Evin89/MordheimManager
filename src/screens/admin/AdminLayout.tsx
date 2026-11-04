import { Navigate, Outlet, useLocation } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import SubTabs from '../../components/SubTabs';
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
  { to: '/admin/custom-warbands', label: 'Custom' },
  { to: '/admin/deleted-warbands', label: 'Deleted' },
  { to: '/admin/maintenance', label: 'Maintenance' },
];

export default function AdminLayout() {
  const { data: isAdmin, isPending } = useIsAdminQuery();
  const { pathname } = useLocation();

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
      <BackHeader title="Admin">
        <SubTabs
          scroll
          items={TABS.map((t) => ({
            label: t.label,
            to: t.to,
            active: pathname === t.to || pathname.startsWith(`${t.to}/`),
          }))}
        />
      </BackHeader>

      <main className="flex-1 px-4 py-4 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
