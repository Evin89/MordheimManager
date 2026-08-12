/**
 * Shown instead of the app when required configuration is missing.
 *
 * Styled with inline styles rather than Tailwind classes, deliberately. This is
 * the screen that appears when something about the build went wrong, so it must
 * not depend on anything that could have gone wrong with it — a missing or
 * misbuilt stylesheet would otherwise turn the explanation into the same blank
 * page it exists to replace.
 *
 * The tone is a fixable mistake, not a crash. The person seeing this is almost
 * always the one who can fix it, and what they need is the variable names and
 * where they go — not an apology.
 */
export default function StartupError({ missing }: { missing: string[] }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#0b0a09',
        color: '#f2ead9',
        fontFamily: 'Georgia, "Times New Roman", serif',
        lineHeight: 1.5,
      }}
    >
      <main style={{ maxWidth: '34rem' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 12px', letterSpacing: '0.04em' }}>
          Not configured
        </h1>

        <p style={{ margin: '0 0 16px' }}>
          The app cannot reach its database because{' '}
          {missing.length === 1 ? 'a required setting is' : 'required settings are'} missing from
          this build:
        </p>

        <ul
          style={{
            margin: '0 0 16px',
            padding: '12px 16px 12px 32px',
            border: '1px solid #2b2724',
            background: '#141210',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '14px',
          }}
        >
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>

        <p style={{ margin: '0 0 8px', color: '#d8c6a1', fontSize: '15px' }}>
          <strong style={{ color: '#f2ead9' }}>Running locally:</strong> copy{' '}
          <code>.env.example</code> to <code>.env.local</code>, fill in both values, and restart the
          dev server.
        </p>

        <p style={{ margin: 0, color: '#d8c6a1', fontSize: '15px' }}>
          {/* The distinction that caused this the first time. Vite substitutes
              import.meta.env during the build, so a value that only exists at
              runtime never reaches the bundle — the build succeeds and the app
              ships unable to reach anything. */}
          <strong style={{ color: '#f2ead9' }}>Deployed:</strong> these must be set as{' '}
          <em>build</em> variables, not runtime ones — they are baked in when the site is compiled,
          so adding them needs a rebuild before it takes effect.
        </p>
      </main>
    </div>
  );
}
