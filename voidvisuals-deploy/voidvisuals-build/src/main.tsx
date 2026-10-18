import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Last-resort boundary. Without it one bad import or one thrown render leaves the site as a black
 * page that nobody can report usefully; with it the reason is on screen in plain text.
 */
class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('VoidVisuals render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '18vh 24px 30vh',
            textAlign: 'center',
            color: '#fff',
            background: '#0b0704',
            minHeight: '100vh',
          }}
        >
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            VoidVisuals
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '18px 0 10px', letterSpacing: '-0.03em' }}>
            This page failed to open.
          </h1>
          <p className="lead" style={{ maxWidth: 620, margin: '0 auto', fontSize: 15 }}>
            {String(this.state.error.message || this.state.error)}
          </p>
          <p className="tagline" style={{ marginTop: 24 }}>
            Screenshot this and send it to voidvisuals999@gmail.com
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>
);
