import React, { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Loader2, Lock, Mail, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { showToast } from '../lib/toast';
import { navigate } from '../router';

interface Props {
  open: boolean;
  onClose: () => void;
}

// The Web API key is a public client identifier (it ships in this bundle by design). Printing its
// ends is what lets the studio owner compare the value in the build against the console at a glance
// instead of re-typing it and breaking it again.
const KEY_HINT = `${firebaseConfig.apiKey.slice(0, 8)}…${firebaseConfig.apiKey.slice(-4)}`;

const MESSAGE: Record<string, string> = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email yet — create one first.',
  'auth/wrong-password': 'Wrong password.',
  'auth/email-already-in-use': 'An account already uses that email. Sign in instead.',
  'auth/weak-password': 'Use at least 8 characters for the password.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/requires-recent-login': 'Sign in again to change this account.',
  'auth/network-request-failed': 'Network problem — check your connection.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google popup. Allow it and retry.',
  'auth/operation-not-supported-in-this-environment':
    'Google sign-in needs a normal browser window (not an embedded one).',
  'auth/operation-not-allowed': 'Email sign-in is not enabled on the Firebase project yet.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase Auth settings yet.',
  'auth/api-key-not-valid':
    'Studio setup: the Firebase Web API key in this build was rejected. Re-copy it from Firebase console → Project settings → Your apps.',
  'auth/invalid-api-key':
    'Studio setup: the Firebase Web API key in this build was rejected. Re-copy it from Firebase console → Project settings → Your apps.',
};

const reason = (err: unknown) => {
  if (!(err instanceof FirebaseError)) return 'Something went wrong.';
  if (/api-key-not-valid|invalid-api-key/i.test(err.message))
    return `${MESSAGE['auth/api-key-not-valid']} This build sends ${KEY_HINT}.`;
  return MESSAGE[err.code] || err.message.replace('Firebase: ', '');
};

export const AuthModal: React.FC<Props> = ({ open, onClose }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verifyHint, setVerifyHint] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    setError('');
    setBusy(false);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const finish = (label: string) => {
    showToast(label, 'good');
    onClose();
    navigate('/portal');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setVerifyHint('');
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
        await sendEmailVerification(cred.user).catch(() => undefined);
        setVerifyHint('We sent a verification link — click it to secure your account.');
        finish('Account created.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        finish('Signed in.');
      }
    } catch (err) {
      setError(reason(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      finish('Signed in with Google.');
    } catch (err) {
      setError(reason(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label="Client sign in" onClick={onClose}>
      <div className="glass-card modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{mode === 'signin' ? 'Client sign in' : 'Create your account'}</h3>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <p className="muted" style={{ marginTop: -8, fontSize: 14 }}>
          An account lets you track your brief and its status. It is not required to send one.
        </p>

        <div className="tabs" style={{ marginTop: 18 }}>
          <button type="button" className={mode === 'signin' ? 'is-on' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button type="button" className={mode === 'signup' ? 'is-on' : ''} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {mode === 'signup' ? (
            <div className="field">
              <label htmlFor="au-name">Your name</label>
              <input
                id="au-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="name"
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="au-email">Email</label>
            <input
              id="au-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="au-pass">Password</label>
            <input
              id="au-pass"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 8 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>

          {error ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
          {verifyHint ? (
            <p className="tagline" style={{ color: '#b9ffe0', marginTop: 4 }}>
              {verifyHint}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin-slow" /> : <Lock size={16} />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="spread" style={{ margin: '18px 0' }}>
          <span className="line-sep" />
          <span className="tagline">or</span>
          <span className="line-sep" />
        </div>

        <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={google} disabled={busy}>
          <Mail size={16} />
          Continue with Google
        </button>

        <p className="form-note" style={{ marginTop: 16 }}>
          Credentials go straight to Firebase Authentication. The studio never sees your password.
        </p>
      </div>
    </div>
  );
};
