import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { SiteConfigData } from '../data/vvData';

interface Msg {
  id: number;
  from: 'me' | 'them';
  text: string;
  at: number;
}

const TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const QUICK = [
  'What will my website cost?',
  'How long does it take?',
  'Is the domain really free?',
  'Can you upgrade my existing site?',
  'What do you need from me to start?',
];

const OPENING =
  'Hi — this is the VoidVisuals studio desk. Ask about pricing, timelines, an upgrade or anything else, in any language you prefer.';

/**
 * Offline answer bank: used when the Worker has no Gemini Secret configured, when the device is
 * offline, or when the request fails. Every answer here is a fact about this studio.
 */
function localAnswer(q: string): string {
  const s = q.toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => s.includes(n));

  if (has('price', 'cost', 'charge', 'rate', 'kitna', 'पैसा', 'দাম', 'खर्च')) {
    return 'Fixed prices, published on the site:\n• Starter ₹2,500 (1–3 pages, 5–7 days)\n• Professional ₹5,000 (5–7 pages, forms + CMS-free enquiry, 10–14 days)\n• Premium ₹8,000 (8–12 pages, custom design language, ~3 weeks)\nAdd-ons: extra page ₹700, animation pack ₹1,500, SEO & speed tune-up ₹1,200, redesign from ₹3,000. Care plan ₹499/month. 50% advance, rest on delivery.';
  }
  if (has('time', 'long', 'fast', 'days', 'kitne din', 'कितने दिन')) {
    return 'Starter lands in 5–7 days, Professional in 10–14, Premium in about 3 weeks. A single landing page can be live in 48 hours. Timeline starts once your brief and content (logo, text, photos) are in.';
  }
  if (has('domain', 'hosting', 'free', 'renew')) {
    return 'The domain is free for the first year on every plan. Hosting is free for the first year on Professional and Premium. From year 2 you pay the registrar renewal price, and we tell you before it happens — no lock-in.';
  }
  if (has('upgrade', 'redesign', 'existing', 'old site', 'fix', 'wordpress', 'migrate')) {
    return 'Yes — the upgrade service rebuilds your current site on a modern stack with the same URLs and content, so rankings and traffic stay intact. It starts at ₹3,000 and usually takes 5–10 days.';
  }
  if (has('start', 'need', 'require', 'material', 'begin')) {
    return 'Send a brief with: what the site is for, the pages or features you want, your logo if you have one, and any photos or text. That is enough to get a fixed price and a start date within 24 hours.';
  }
  if (has('own', 'code', 'handover', 'lock', 'cancel')) {
    return 'You own everything: domain, code, content and hosting access are handed over at launch. The care plan (₹499/month) is optional, never a condition.';
  }
  if (has('payment', 'pay', 'advance', 'upi', 'razorpay')) {
    return 'We quote first, then take 50% to open the slot and the rest when the site is live. Payment details are shared with your quote — UPI or bank transfer.';
  }
  if (has('contact', 'call', 'whatsapp', 'email', 'reach')) {
    return 'WhatsApp or call the studio on the number in the footer, email the address there too, or send the brief form — it lands directly in the studio inbox. Replies within 24 hours, usually the same day.';
  }
  if (has('hindi', 'हिंदी', 'bangla', 'বাংলা', 'language', 'भाषा')) {
    return 'आप जिस भाषा में पूछेंगे, जवाब उसी भाषा में मिलेगा। Ask in Hindi, Bangla, Tamil or English — the studio desk answers the same way.';
  }
  return 'Good question — the studio team answers that personally. Send a brief or WhatsApp us and you will get a real reply within 24 hours. Meanwhile: pricing is on the Plans page, and delivery is 5–14 days depending on the tier.';
}

interface Props {
  config: SiteConfigData;
  email: string;
  /** Bumping this number opens the chat from elsewhere — the right-click menu uses it. */
  openSignal?: number;
}

export const SupportChat: React.FC<Props> = ({ config, email, openSignal = 0 }) => {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Msg[]>([{ id: 0, from: 'them', text: OPENING, at: Date.now() }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const seq = useRef(1);
  const logRef = useRef<HTMLDivElement | null>(null);
  const history = useRef<Array<{ role: 'user' | 'model'; text: string }>>([]);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, log, busy]);

  const send = async (raw: string) => {
    const question = raw.trim().slice(0, 600);
    if (!question || busy) return;
    setLog((prev) => [...prev, { id: seq.current++, from: 'me', text: question, at: Date.now() }]);
    setText('');
    setBusy(true);
    setNote('');

    let answer = '';
    try {
      const res = await fetch('/api/support/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: history.current.slice(-6),
          email,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; answer?: string; error?: string }
        | null;
      if (res.ok && data?.ok && data.answer) {
        answer = data.answer;
      } else if (data?.error === 'ai-not-configured') {
        answer = localAnswer(question);
        setNote('Answered from the studio fact sheet (AI desk not configured yet).');
      } else {
        answer = localAnswer(question);
        setNote('Answered offline from the studio fact sheet.');
      }
    } catch {
      answer = localAnswer(question);
      setNote('No network to the AI desk — answered from the studio fact sheet.');
    }

    history.current = [
      ...history.current.slice(-5),
      { role: 'user', text: question },
      { role: 'model', text: answer },
    ];
    setLog((prev) => [...prev, { id: seq.current++, from: 'them', text: answer, at: Date.now() }]);
    setBusy(false);
  };

  return (
    <>
      {open ? (
        <div className="chat" role="dialog" aria-label="Studio support chat">
          <div className="chat-head">
            <span className="ico" style={{ width: 38, height: 38, borderRadius: 13, margin: 0 }}>
              <Sparkles size={17} />
            </span>
            <div style={{ flex: 1 }}>
              <b>Studio desk</b>
              <div className="status">
                <span className="dot" style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--mint)' }} />
                online · answers in your language
              </div>
            </div>
            <button type="button" className="x" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="chat-log" ref={logRef}>
            {log.map((m) => (
              <div key={m.id} className={`bubble ${m.from}`}>
                {m.text}
                <span className="time">{TIME.format(new Date(m.at))} IST</span>
              </div>
            ))}
            {busy ? (
              <div className="bubble them">
                <span className="typing">
                  <s />
                  <s />
                  <s />
                </span>
              </div>
            ) : null}
          </div>

          <div className="chat-quick">
            {QUICK.filter((q) => !log.some((m) => m.text === q)).map((q) => (
              <button key={q} type="button" onClick={() => void send(q)} disabled={busy}>
                {q}
              </button>
            ))}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask anything… any language"
              maxLength={600}
              aria-label="Your question"
            />
            <button type="submit" aria-label="Send" disabled={busy || !text.trim()}>
              <Send size={17} />
            </button>
          </form>

          <div className="chat-foot">
            {note || 'Every chat can be handed to a human — same day reply.'}
            <a className="hl" href={config.whatsappUrl} target="_blank" rel="noreferrer noopener" style={{ fontWeight: 700 }}>
              WhatsApp us
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="chat-fab"
          aria-label="Open studio support chat"
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={24} />
        </button>
      )}
    </>
  );
};
