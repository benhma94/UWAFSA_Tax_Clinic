// Public website UI kit — component library
const { useState, useEffect } = React;

const LOGO_SRC = '../../assets/logo.png';

function Header() {
  return (
    <header className="site-header">
      <a href="#" onClick={e => { e.preventDefault(); setPage('home'); }}>
        <img src={LOGO_SRC} alt="AFSA Tax Clinic" />
      </a>
    </header>
  );
}

function Nav({ page, setPage }) {
  const items = [
    ['home', 'Home'],
    ['faq', 'FAQ'],
    ['checklist', 'Checklist'],
    ['postfiling', 'Post-Filing'],
    ['about', 'About'],
    ['volunteer', 'Volunteer'],
  ];
  return (
    <nav className="site-nav" aria-label="Primary">
      {items.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={page === id ? 'active' : ''}
           onClick={e => { e.preventDefault(); setPage(id); }}>{label}</a>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="brand">UW AFSA Tax Clinic</div>
      <div>Free walk-in tax filing · University of Waterloo · Since 2009</div>
      <div className="links">
        <a href="https://instagram.com/uwafsa" aria-label="Instagram">
          <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </a>
        <a href="mailto:taxclinic@uwafsa.com" aria-label="Email">
          <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </a>
      </div>
      <div style={{ fontSize: '.78rem', opacity: .75 }}>© 2026 Accounting & Finance Student Association</div>
    </footer>
  );
}

function DarkModeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark-mode'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark-mode', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button className="dm-toggle" onClick={toggle} aria-label="Toggle theme">
      {dark
        ? <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
    </button>
  );
}

function ClinicStatusPanel({ status = 'open' }) {
  const copy = {
    open:    { pill: ['open',   'Open now'],      title: 'The clinic is open', msg: 'Walk in now — a volunteer is ready to help. No appointment required.' },
    closed:  { pill: ['closed', 'Closed'],         title: 'Clinic is closed',   msg: "We're not running right now. The next clinic date is below." },
    loading: { pill: ['loading','Checking'],       title: 'Loading live status…', msg: 'We are checking the live queue and volunteer coverage now.' },
  }[status];
  return (
    <section className="clinic-status-panel" aria-live="polite">
      <div className="clinic-status-panel__header">
        <div>
          <p className="clinic-status-kicker">Public clinic status</p>
          <h3 className="clinic-status-title">{copy.title}</h3>
        </div>
        <span className={`clinic-status-pill ${copy.pill[0]}`}>{copy.pill[1]}</span>
      </div>
      <p className="clinic-status-message">{copy.msg}</p>
      <div className="clinic-status-meta">
        <div><span className="clinic-status-meta-label">Queue</span><strong>{status==='open'?'3 waiting':'—'}</strong></div>
        <div><span className="clinic-status-meta-label">Volunteers</span><strong>{status==='open'?'12 on floor':'—'}</strong></div>
        <div><span className="clinic-status-meta-label">Next clinic</span><strong>Sat Mar 21</strong></div>
      </div>
      <p className="clinic-status-updated">Last updated 2 min ago · refreshes every 60s</p>
    </section>
  );
}

function ScheduleTable() {
  const rows = [
    ['Saturday, March 21, 2026', 'STC 1012', '10:00 AM – 7:30 PM'],
    ['Sunday, March 22, 2026',   'STC 1012', '10:00 AM – 7:30 PM'],
    ['Saturday, March 28, 2026', 'RCH 301',  '10:00 AM – 7:30 PM'],
    ['Sunday, March 29, 2026',   'STC 1012', '10:00 AM – 7:30 PM'],
  ];
  return (
    <table>
      <thead><tr><th>Date</th><th>Location</th><th>Time</th></tr></thead>
      <tbody>{rows.map(([d,l,t]) => <tr key={d}><td>{d}</td><td><a href="#">{l}</a></td><td>{t}</td></tr>)}</tbody>
    </table>
  );
}

function Callout({ children }) { return <div className="callout-box">{children}</div>; }
function SectionHeading({ children, id }) { return <h3 className="section-heading" id={id}>{children}</h3>; }

function ToolCard({ title, desc, href }) {
  return (
    <a className="tool-card" href={href || '#'} onClick={e => e.preventDefault()}>
      <p className="t">{title}</p>
      <p className="d">{desc}</p>
    </a>
  );
}

function FaqCategory({ title, defaultOpen = false, children }) {
  return (
    <details className="faq-cat" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="faq-item">{children}</div>
    </details>
  );
}
function FaqItem({ q, children, defaultOpen = false }) {
  return (
    <details open={defaultOpen}>
      <summary>{q}</summary>
      {children}
    </details>
  );
}

Object.assign(window, {
  Header, Nav, Footer, DarkModeToggle,
  ClinicStatusPanel, ScheduleTable, Callout, SectionHeading,
  ToolCard, FaqCategory, FaqItem,
});
