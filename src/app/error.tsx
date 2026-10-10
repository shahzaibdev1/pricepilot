'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>We couldn’t load this page</h1>
        <p>Please check your connection and database setup, then try again.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <a href="/demo">Open the local demo</a>
      </div>
    </main>
  );
}
