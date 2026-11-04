import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

/**
 * §38 — a player's name that opens their profile.
 *
 * A link only when signed in: profiles need an account, so for a signed-out
 * reader it renders as plain text rather than sending them to a sign-in wall
 * from a name they only wanted to read.
 */
export default function PlayerLink({
  userId,
  children,
  className = '',
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { user } = useAuth();
  if (!user) return <span className={className}>{children}</span>;
  return (
    <Link
      to={`/players/${userId}`}
      className={`underline decoration-ink-700 underline-offset-2 hover:decoration-ember-500 ${className}`}
    >
      {children}
    </Link>
  );
}
