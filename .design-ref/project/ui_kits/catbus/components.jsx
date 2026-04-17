// CATBUS — shared UI primitives
const { useState: useStateC, useEffect: useEffectC } = React;

const CBLOGO = '../../assets/logo.png';

function TopBar({ user = 'Ben Ma', role = 'Admin' }) {
  const [dark, setDark] = useStateC(() => document.documentElement.classList.contains('dark'));
  const toggle = () => { const n = !dark; setDark(n); document.documentElement.classList.toggle('dark', n); };
  return (
    <div className="topbar">
      <div className="brand">
        <img src={CBLOGO} alt="AFSA" />
        <div>
          <div className="title">CATBUS</div>
          <div className="sub">Client And Tax Booking Utility System</div>
        </div>
      </div>
      <div className="user">
        <button className="theme-toggle" onClick={toggle} aria-label="Theme">
          <span className="thumb">{dark ? '🌙' : '☀️'}</span>
        </button>
        <div style={{ textAlign:'right', lineHeight:1.1 }}>
          <div style={{ fontWeight:600 }}>{user}</div>
          <div style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>{role}</div>
        </div>
        <span className="avatar">{user.split(' ').map(w => w[0]).join('').slice(0,2)}</span>
      </div>
    </div>
  );
}

function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs">
      {items.map(([id, label]) => (
        <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

function FormSection({ title, children, subtitle }) {
  return (
    <section className="form-section">
      {title && <h2>{title}</h2>}
      {subtitle && <p className="muted" style={{ marginTop:4 }}>{subtitle}</p>}
      <div className="mt">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function StatCard({ label, value, delta }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

function RolePill({ role }) {
  const cls = { Mentor:'role-mentor', Frontline:'role-frontline', Filer:'role-filer', 'Internal Services':'role-internal' }[role] || 'role-frontline';
  return <span className={`pill ${cls}`}>{role}</span>;
}

function Modal({ title, onClose, children, onConfirm, confirmLabel='Save' }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <div>{children}</div>
        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          {onConfirm && <button className="btn primary" onClick={onConfirm}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, kind='ok' }) {
  if (!msg) return null;
  return <div className={`toast ${kind==='err'?'err':''}`}>{msg}</div>;
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d[1]));
  return (
    <div>
      {data.map(([label, v]) => (
        <div key={label} className="bar-row">
          <div style={{ fontWeight:600 }}>{label}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width:`${(v/max)*100}%` }} /></div>
          <div style={{ textAlign:'right', color:'var(--text-muted)', fontWeight:600 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return <div className="app-footer">Designed by Ben Ma, CPA, CFA, CFP for the UW AFSA Tax Clinic</div>;
}

Object.assign(window, { TopBar, Tabs, FormSection, Field, StatCard, RolePill, Modal, Toast, BarChart, Footer });
