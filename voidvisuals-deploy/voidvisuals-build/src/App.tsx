import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { BRAND, CONTACT_EMAIL, WHATSAPP_URL } from './config';
import { PlanDoc, price } from './data/vvData';
import { parseRoute, installLinkInterceptor, navigate, usePath } from './router';
import { isConsolePath } from './lib/adminGate';
import { BUILD_TAG } from './version';
import { useLiveContent } from './lib/content';
import { recordAudit } from './lib/audit';
import { pageEnter, refreshReveals } from './lib/motion';
import { usePrefs } from './lib/prefs';
import { addPlan, useCart } from './lib/cart';
import { onToast, showToast, type Toast } from './lib/toast';
import { AuroraStage } from './components/AuroraStage';
import { CustomCursor } from './components/CustomCursor';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { HeroSection } from './components/HeroSection';
import { Marquee } from './components/Marquee';
import { ServicesSection } from './components/ServicesSection';
import { WorkSection } from './components/WorkSection';
import { ProcessSection } from './components/ProcessSection';
import { PlansSection } from './components/PlansSection';
import { TechStackSection } from './components/TechStackSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { FaqSection } from './components/FaqSection';
import { CtaBand } from './components/CtaBand';
import { BriefSection, type BriefPreset } from './components/BriefSection';
import { StudioSection } from './components/StudioSection';
import { AuthModal } from './components/AuthModal';
import { ClientPortal } from './components/ClientPortal';
import { AdminConsole } from './components/AdminConsole';
import { SupportChat } from './components/SupportChat';
import { SalesGlobe } from './components/SalesGlobe';
import { QuickMenu } from './components/QuickMenu';
import { CartBar } from './components/CartBar';
import { CheckoutSheet } from './components/CheckoutSheet';

const TITLES: Record<string, string> = {
  home: `${BRAND} — Websites that feel alive`,
  studio: `Studio · ${BRAND}`,
  work: `Selected work · ${BRAND}`,
  plans: `Pricing & plans · ${BRAND}`,
  contact: `Start a project · ${BRAND}`,
  portal: `My projects · ${BRAND}`,
  notfound: `Page not found · ${BRAND}`,
};

const NoIndex: React.FC = () => {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nosnippet,noarchive,noodp';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return null;
};

export default function App() {
  const path = usePath();
  const { page } = useMemo(() => parseRoute(path), [path]);
  const content = useLiveContent();
  const { lang } = usePrefs();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [consoleMatch, setConsoleMatch] = useState<boolean | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [chatSignal, setChatSignal] = useState(0);
  const [preset, setPreset] = useState<BriefPreset | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const bodyRef = useMemo(() => React.createRef<HTMLDivElement>(), []);
  const cart = useCart();

  // Router plumbing.
  useEffect(() => installLinkInterceptor(), []);

  useEffect(() => {
    document.title = TITLES[page] || TITLES.home;
  }, [page]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Console detection is async (WebCrypto), so unknown paths never flash a 404 while it resolves.
  useEffect(() => {
    let alive = true;
    setConsoleMatch(null);
    void isConsolePath(path).then((matched) => {
      if (alive) setConsoleMatch(matched);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setAuthReady(true);
    });
    // Firebase can hold the first callback if its network handshake stalls; the site must stay usable.
    const failsafe = setTimeout(() => setAuthReady(true), 4000);
    return () => {
      unsub();
      clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => onToast((toast) => {
    setToasts((prev) => [...prev.slice(-3), toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 5200);
  }), []);

  // Motion layer rebinds after every route change and after live content arrives.
  useEffect(() => {
    if (consoleMatch) return;
    refreshReveals();
    pageEnter(bodyRef.current);
    const id = setTimeout(() => refreshReveals(), 320);
    return () => clearTimeout(id);
  }, [page, lang, consoleMatch, content.ready, content.work.length, content.plans.length, bodyRef]);

  const email = user?.email ?? '';

  // One trail entry per session for the public site: who signed in, from where.
  const signedInRef = useRef('');
  useEffect(() => {
    const uid = user?.uid || '';
    if (!uid || uid === signedInRef.current) return;
    signedInRef.current = uid;
    void recordAudit({
      category: 'CUSTOMER',
      action: 'signed in',
      target: 'client-portal',
      summary: `${user?.email || 'unknown'} signed in to the studio portal`,
    });
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await signOut(auth).catch(() => undefined);
    showToast('Signed out.', 'info');
    navigate('/');
  }, []);

  // "Add to cart" is the money path; the brief stays for anyone who would rather talk first.
  const buyPlan = useCallback((plan: PlanDoc) => {
    const added = addPlan(plan);
    setCartOpen(true);
    showToast(
      added
        ? `${plan.name} added — ${price(plan.priceInr)}. Scan the UPI QR when you are ready.`
        : 'That item is already in the cart at its maximum quantity.',
      added ? 'good' : 'info'
    );
  }, []);

  const choosePlan = useCallback((plan: PlanDoc) => {
    const budget =
      plan.category === 'website'
        ? plan.priceInr <= 2500
          ? 'Under ₹2,500'
          : plan.priceInr <= 5000
            ? '₹2,500 – ₹5,000'
            : '₹5,000 – ₹8,000'
        : plan.category === 'care'
          ? 'Under ₹2,500'
          : 'Not sure yet';
    setPreset({
      service:
        plan.category === 'care'
          ? 'SEO & speed tune-up'
          : plan.id === 'addon_redesign'
            ? 'Website upgrade / redesign'
            : plan.category === 'addon'
              ? 'Something else'
              : 'New website',
      budget,
      details: `I would like the “${plan.name}” option (${plan.periodLabel}). Here is what I need:\n\n`,
      stamp: Date.now(),
    });
    showToast(`${plan.name} selected — finish the brief and we will quote it.`, 'good');
    navigate('/contact');
  }, []);

  const couponPercent = useMemo(() => {
    const code = cart.coupon.trim().toUpperCase();
    if (!code) return 0;
    return content.coupons.find((c) => c.code.toUpperCase() === code)?.discountPercent ?? 0;
  }, [cart.coupon, content.coupons]);

  const renderPage = () => {
    if (page === 'studio') {
      return (
        <>
          <StudioSection config={content.config} />
          <Marquee />
          <TechStackSection />
          <ProcessSection />
          <TestimonialsSection items={content.testimonials} />
          <CtaBand config={content.config} />
        </>
      );
    }
    if (page === 'work') {
      return (
        <>
          <WorkSection
            items={content.work}
            eyebrow="Portfolio"
            titlePlain="Everything we have"
            titleAccent="shipped"
            intro="Real builds, live URLs, sorted by kind. Click any project for the detail."
          />
          <SalesGlobe />
          <CtaBand config={content.config} />
        </>
      );
    }
    if (page === 'plans') {
      return (
        <>
          <PlansSection
            config={content.config}
            plans={content.plans}
            coupons={content.coupons}
            onChoose={choosePlan}
            onBuy={buyPlan}
          />
          <TechStackSection />
          <FaqSection compact />
          <CtaBand config={content.config} />
        </>
      );
    }
    if (page === 'contact') {
      return (
        <>
          <BriefSection config={content.config} preset={preset} />
          <FaqSection compact />
        </>
      );
    }
    if (page === 'portal') {
      return (
        <div className="page-top">
          <ClientPortal
            user={user}
            ready={authReady}
            onOpenAuth={() => setAuthOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>
      );
    }
    if (page === 'notfound') {
      return (
        <div className="nf">
          <div className="shell">
            <h1>404</h1>
            <p className="lead" style={{ margin: '10px auto 0' }}>
              That page does not exist here. The studio home is a better starting point.
            </p>
            <div className="row center" style={{ justifyContent: 'center', marginTop: 26 }}>
              <a
                className="btn btn-primary"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                }}
              >
                Back to home
              </a>
              <a
                className="btn btn-ghost"
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/contact');
                }}
              >
                Start a project
              </a>
            </div>
            <p style={{ marginTop: 20, fontSize: 11, letterSpacing: '.14em', opacity: 0.4 }}>
              build {BUILD_TAG}
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <HeroSection config={content.config} />
        <Marquee />
        <ServicesSection />
        <WorkSection items={content.work} limit={3} />
        <PlansSection
          config={content.config}
          plans={content.plans}
          coupons={content.coupons}
          onChoose={choosePlan}
          onBuy={buyPlan}
        />
        <TechStackSection />
        <ProcessSection />
        <SalesGlobe />
        <TestimonialsSection items={content.testimonials} />
        <FaqSection />
        <CtaBand config={content.config} />
      </>
    );
  };

  // The console owns the whole viewport and is only reachable through its digest-matched path.
  if (consoleMatch) {
    return (
      <>
        <NoIndex />
        <AdminConsole email={email} ready={authReady} onOpenAuth={() => setAuthOpen(true)} />
        {/* Always mounted: gating this on authReady made the sign-in button dead. */}
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (consoleMatch === null) {
    return (
      <div className="boot">
        <div className="inner">
          <span className="eyebrow">VoidVisuals</span>
          <div className="bar">
            <i />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CustomCursor />
      <AuroraStage />
      <div className="page" ref={bodyRef}>
        <SiteHeader brandName={content.config.brandName} signedIn={Boolean(user)} onOpenCart={() => setCartOpen(true)} />
        {/* Remounting on language change is what keeps the split headlines honest: the word
            spans are made outside React, so plain text has to be re-rendered before they are
            rebuilt by refreshReveals(). */}
        <main key={lang}>{renderPage()}</main>
        <SiteFooter
          config={content.config}
          signedIn={Boolean(user)}
          onOpenAuth={() => setAuthOpen(true)}
          onSignOut={handleSignOut}
        />
      </div>

      <SupportChat config={content.config} email={email} openSignal={chatSignal} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <CartBar couponPercent={couponPercent} onOpen={() => setCartOpen(true)} />
      <CheckoutSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        coupons={content.coupons}
        plans={content.plans}
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
      />
      <QuickMenu
        brandName={content.config.brandName}
        contactEmail={content.config.contactEmail || CONTACT_EMAIL}
        whatsappUrl={content.config.whatsappUrl || WHATSAPP_URL}
        signedIn={Boolean(user)}
        cartCount={cart.lines.reduce((sum, l) => sum + l.qty, 0)}
        onNavigate={navigate}
        onOpenChat={() => setChatSignal((n) => n + 1)}
        onOpenCart={() => setCartOpen(true)}
        onSignIn={() => setAuthOpen(true)}
      />

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
