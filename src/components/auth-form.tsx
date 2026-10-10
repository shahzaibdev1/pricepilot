'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, ArrowRight } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
export default function AuthForm({
  reset = false,
  configured = true,
  confirmationError = false,
}: {
  reset?: boolean;
  configured?: boolean;
  confirmationError?: boolean;
}) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      confirmationError
        ? 'The confirmation link expired or could not be verified. Request a new link.'
        : '',
    ),
    [message, setMessage] = useState(''),
    [canReset, setCanReset] = useState(false);
  useEffect(() => {
    if (reset && configured)
      browserClient()
        .auth.getUser()
        .then(({ data }) => setCanReset(Boolean(data.user)));
  }, [reset, configured]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const client = browserClient();
      const redirect = `${window.location.origin}/auth/callback`;
      if (reset) {
        if (canReset) {
          const r = await client.auth.updateUser({ password });
          if (r.error) throw r.error;
          setMessage('Password updated. You can now open your workspace.');
        } else {
          const r = await client.auth.resetPasswordForEmail(email, {
            redirectTo: redirect + '?next=/reset',
          });
          if (r.error) throw r.error;
          setMessage('If an account exists, a password reset link has been sent.');
        }
      } else if (signup) {
        const r = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (r.error) throw r.error;
        if (r.data.session) window.location.assign('/app');
        else setMessage('Check your email to confirm your account, then sign in.');
      } else {
        const r = await client.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        window.location.assign('/app');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete sign-in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Layers size={23} />
          </span>
          PricePilot
        </Link>
        <div>
          <span className="eyebrow">LESS SPREADSHEET WORK. MORE CONTROL.</span>
          <h2>
            Supplier prices change.
            <br />
            Your process shouldn’t.
          </h2>
          <p>
            Bring your price lists together, spot the changes that matter, and update your catalogue
            with confidence.
          </p>
          <div className="story-note">
            Upload. Review. Export.
            <br />
            <span>A clear path from supplier file to selling price.</span>
          </div>
        </div>
        <small>Built for the people who keep products moving.</small>
      </div>
      <div className="auth-card">
        <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
        <h1>
          {reset
            ? canReset
              ? 'Choose a new password'
              : 'Reset your password'
            : signup
              ? 'Create your account'
              : 'Welcome back'}
        </h1>
        <p className="muted">
          {reset
            ? 'We’ll help you get back to your catalogue.'
            : signup
              ? 'Start with your first supplier and price list.'
              : 'Sign in to your supplier pricing workspace.'}
        </p>
        {!configured && (
          <div className="notice warning">
            Supabase needs configuration before account access. The local demo works immediately.
          </div>
        )}
        {error && (
          <div role="alert" className="notice danger">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="notice success">
            {message}
          </div>
        )}
        <form onSubmit={submit}>
          <fieldset disabled={busy || !configured}>
            {!canReset && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </label>
            )}
            {(!reset || canReset) && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={signup || canReset ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            <button className="button primary full" type="submit">
              {busy
                ? 'Please wait…'
                : reset
                  ? canReset
                    ? 'Update password'
                    : 'Send reset link'
                  : signup
                    ? 'Create account'
                    : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </fieldset>
        </form>
        {!reset && (
          <>
            <Link className="text-link" href="/reset">
              Forgot your password?
            </Link>
            <p className="auth-switch">
              {signup ? 'Already have an account?' : 'New to PricePilot?'}{' '}
              <button
                className="text-button"
                onClick={() => {
                  setSignup(!signup);
                  setError('');
                  setMessage('');
                }}
              >
                {signup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </>
        )}
        {reset && (
          <Link className="text-link" href={canReset ? '/app' : '/login'}>
            {canReset ? 'Open workspace' : 'Back to sign in'}
          </Link>
        )}
        <div className="auth-demo">
          <span>Want to see it first?</span>
          <Link href="/demo">
            Explore the local demo <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}
