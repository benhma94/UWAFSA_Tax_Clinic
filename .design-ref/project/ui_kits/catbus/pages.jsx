// CATBUS — dashboard views
const { useState: useStateD } = React;

function QueueDashboard() {
  const [rows, setRows] = useStateD([
    { id:'P012', wait:4,  situation:'Newcomer · First-time filer', priority:true, assigned:null },
    { id:'B047', wait:9,  situation:'Student · T2202',             priority:false, assigned:'Rayya P.' },
    { id:'C118', wait:18, situation:'Married · Children',          priority:false, assigned:null },
    { id:'D204', wait:32, situation:'Student · International ITN', priority:false, assigned:null },
    { id:'E311', wait:14, situation:'Senior · Pension slips',      priority:false, assigned:'Marc T.' },
  ]);
  const [assigning, setAssigning] = useStateD(null);
  const [toast, setToast] = useStateD('');

  const assign = () => {
    setRows(rs => rs.map(r => r.id === assigning.id ? { ...r, assigned: 'You' } : r));
    setToast(`Client ${assigning.id} assigned to you`);
    setAssigning(null);
    setTimeout(() => setToast(''), 2400);
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="In Queue" value={rows.filter(r=>!r.assigned).length} delta="2 flagged priority" />
        <StatCard label="Avg Wait" value="14m" delta="+3m vs. last hour" />
        <StatCard label="Longest Wait" value="32m" delta="escalate: D204" />
        <StatCard label="Volunteers on Floor" value="12" delta="4 filing · 6 frontline · 2 mentors" />
      </div>

      <div className="between mt-lg">
        <h2>Client Queue</h2>
        <div className="hstack">
          <button className="btn secondary">🔄 Refresh</button>
          <button className="btn primary">+ Add walk-in</button>
        </div>
      </div>

      <table className="data-table mt">
        <thead><tr><th>Client ID</th><th>Wait</th><th>Situation</th><th>Assigned</th><th style={{width:1}}>Action</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.wait >= 30 ? 'danger' : r.wait >= 15 ? 'warn' : ''}>
              <td style={{ fontWeight:600 }}>
                {r.priority && <span className="pill hp" style={{ marginRight:8 }}>HIGH PRIORITY</span>}
                {r.id}
              </td>
              <td>{r.wait} m</td>
              <td>{r.situation}</td>
              <td>{r.assigned || <span className="muted">— unassigned</span>}</td>
              <td>
                {r.assigned
                  ? <button className="btn ghost">View</button>
                  : <button className="btn primary" onClick={() => setAssigning(r)}>Assign to me</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {assigning && (
        <Modal title={`Assign client ${assigning.id}?`} onClose={() => setAssigning(null)} onConfirm={assign} confirmLabel="✅ Assign">
          <p><strong>{assigning.situation}</strong></p>
          <p className="muted">Wait time: {assigning.wait} minutes. They'll be notified to come to your station.</p>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  );
}

function VolunteerManagement() {
  const [vols] = useStateD([
    { name:'Rayya Patel',      role:'Filer',             program:'AFM 3B', status:'On floor' },
    { name:'Marcus Tanaka',    role:'Mentor',            program:'CPA candidate', status:'On floor' },
    { name:'Lin Xu',           role:'Frontline',         program:'AFM 2A', status:'Break' },
    { name:'Sana Al-Rashid',   role:'Filer',             program:'AFM 4A', status:'On floor' },
    { name:'Jordan Beaumont',  role:'Internal Services', program:'AFM 2B', status:'Off-site' },
    { name:'Priya Kohli',      role:'Mentor',            program:'CPA, CFE', status:'On floor' },
  ]);
  return (
    <>
      <div className="between">
        <h2>Volunteer Roster</h2>
        <div className="hstack">
          <input placeholder="🔍 Search volunteers…" style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontFamily:'inherit', background:'var(--surface)', color:'var(--text)' }} />
          <button className="btn primary">+ Add volunteer</button>
        </div>
      </div>
      <div className="card-grid mt-lg">
        {vols.map(v => (
          <div key={v.name} className="vol-card">
            <div className="vol-head">
              <div>
                <div className="name">{v.name}</div>
                <div className="sub">{v.program}</div>
              </div>
              <span className="avatar" style={{ background: 'var(--accent)' }}>{v.name.split(' ').map(w=>w[0]).join('')}</span>
            </div>
            <div className="between mt">
              <RolePill role={v.role} />
              <span className="muted" style={{ fontSize:'.82rem' }}>{v.status}</span>
            </div>
            <div className="hstack mt" style={{ justifyContent:'flex-end' }}>
              <button className="btn ghost" title="Edit">✏️ Edit</button>
              <button className="btn ghost" title="Message">✉️ Message</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Coverage() {
  const days = ['Sat Mar 21', 'Sun Mar 22', 'Sat Mar 28', 'Sun Mar 29'];
  const shifts = ['10:00–1:00', '1:00–4:30', '4:30–7:30'];
  const staff = { '0-0':8,'0-1':12,'0-2':10,'1-0':7,'1-1':11,'1-2':9,'2-0':10,'2-1':14,'2-2':11,'3-0':6,'3-1':10,'3-2':8 };
  const heat = n => n >= 12 ? 'rgba(46,204,113,.25)' : n >= 9 ? 'rgba(241,196,15,.22)' : 'rgba(231,76,60,.22)';
  return (
    <>
      <h2>Coverage Heatmap · Spring 2026</h2>
      <p className="muted">At-a-glance volunteer coverage across all 12 shifts. Target ≥ 10 per shift; red cells flag under-staffing for queue masters.</p>
      <table className="data-table mt">
        <thead><tr><th>Shift</th>{days.map(d => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {shifts.map((s, si) => (
            <tr key={s}>
              <td style={{ fontWeight:700 }}>{s}</td>
              {days.map((d, di) => {
                const n = staff[`${di}-${si}`];
                return <td key={d} style={{ background: heat(n), fontWeight:600 }}>{n} vols</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Schedule() {
  const [days, setDays] = useStateD(['Saturday March 21 2026','Sunday March 22 2026','Saturday March 28 2026','Sunday March 29 2026']);
  const [opts, setOpts] = useStateD({ lockPast:false, partial:true, notify:true });
  const [result, setResult] = useStateD(null);
  const [generating, setGenerating] = useStateD(false);
  const [editing, setEditing] = useStateD(null);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setResult({
        totalShifts:12, shiftsFilled:12, totalVolunteers:94, totalAssignments:268,
        notificationsSent: opts.notify ? 14 : 0,
        roles:{ filers:38, mentors:11, frontline:34, internalServices:11 },
        shortfalls:[{ shiftId:'D1A', role:'Mentor', actual:2, target:3 },{ shiftId:'D4A', role:'Filer', actual:8, target:10 }],
        shiftRoleCounts:{
          D1A:{filer:9,mentor:2,frontline:8,internalServices:3}, D1B:{filer:12,mentor:3,frontline:9,internalServices:3}, D1C:{filer:10,mentor:3,frontline:8,internalServices:3},
          D2A:{filer:8,mentor:3,frontline:7,internalServices:2}, D2B:{filer:11,mentor:3,frontline:8,internalServices:3}, D2C:{filer:9,mentor:3,frontline:8,internalServices:2},
          D3A:{filer:11,mentor:3,frontline:9,internalServices:3}, D3B:{filer:14,mentor:4,frontline:10,internalServices:3}, D3C:{filer:11,mentor:3,frontline:9,internalServices:3},
          D4A:{filer:8,mentor:2,frontline:7,internalServices:2}, D4B:{filer:11,mentor:3,frontline:8,internalServices:3}, D4C:{filer:9,mentor:3,frontline:7,internalServices:2},
        }
      });
    }, 900);
  };

  const vols = ['Rayya Patel','Marcus Tanaka','Lin Xu','Sana Al-Rashid','Priya Kohli'];
  const roleColors = { filer:'#9b59b6', mentor:'#3498db', frontline:'#2ecc71', internalServices:'#e74c3c' };
  const slotLabels = ['Morning','Afternoon','Evening']; const slotKeys = ['A','B','C'];

  return (
    <>
      <h1>📅 Tax Clinic Schedule Generator</h1>
      <p className="muted">Auto-assign volunteers to the 12 clinic shifts based on their availability. Outputs to the "Shift Schedule" sheet.</p>

      <FormSection title="Day Labels" subtitle="Custom labels for the 4 clinic days.">
        <div className="form-row">
          {days.map((d, i) => (
            <Field key={i} label={`Day ${i+1}`}><input value={d} onChange={e => { const n=[...days]; n[i]=e.target.value; setDays(n); }} /></Field>
          ))}
        </div>
      </FormSection>

      <FormSection title="Update Mode">
        {[
          ['lockPast','Lock past shifts','Keep existing schedule for clinic days before today unchanged.'],
          ['partial','Preserve unchanged volunteers','Only re-schedule volunteers who updated their availability since the last generation.'],
          ['notify','Inform volunteers via email','Volunteers whose shifts changed will receive an email.'],
        ].map(([k, lbl, help]) => (
          <label key={k} style={{ display:'block', margin:'10px 0', cursor:'pointer' }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <input type="checkbox" checked={opts[k]} onChange={e => setOpts({ ...opts, [k]:e.target.checked })} style={{ width:18, height:18 }} />
              <span style={{ fontWeight:600 }}>{lbl}</span>
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginLeft:28 }}>{help}</div>
          </label>
        ))}
      </FormSection>

      <div className="hstack" style={{ marginBottom:20 }}>
        <button className="btn primary" onClick={generate} disabled={generating} style={{ flex:1, padding:'15px', fontSize:16, justifyContent:'center' }}>
          {generating ? '⏳ Generating Schedule…' : 'Generate Schedule'}
        </button>
        <button className="btn secondary" style={{ padding:'15px' }}>Consecutive Shift Analysis</button>
        <button className="btn secondary" style={{ padding:'15px', background:'#3498db', color:'#fff', border:'none' }}>🔍 Debug Data</button>
      </div>

      {result && (
        <div className="form-section" style={{ background:'var(--bg)' }}>
          <h2>Schedule Generation Results</h2>
          <div className="stat-grid mt">
            <StatCard label="Total Shifts" value={result.totalShifts} />
            <StatCard label="Shifts Filled" value={result.shiftsFilled} />
            <StatCard label="Volunteers" value={result.totalVolunteers} />
            <StatCard label="Assignments" value={result.totalAssignments} />
          </div>
          {result.notificationsSent > 0 && (
            <p style={{ marginTop:8 }}>📧 <strong>{result.notificationsSent}</strong> change notifications sent.</p>
          )}

          <h3 style={{ marginTop:16 }}>Volunteers by Role</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:8 }}>
            {[['Filers', result.roles.filers, '#9b59b6'],['Mentors', result.roles.mentors, '#3498db'],['Frontline', result.roles.frontline, '#2ecc71'],['Internal Services', result.roles.internalServices, '#e74c3c']].map(([l,v,c]) => (
              <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:'.75rem', textTransform:'uppercase', color:'var(--text-muted)', fontWeight:700 }}><span style={{ display:'inline-block', width:10, height:10, background:c, borderRadius:2, marginRight:6 }} />{l}</div>
                <div style={{ fontSize:'1.4em', fontWeight:700, color:'var(--accent)' }}>{v}</div>
              </div>
            ))}
          </div>

          {result.shortfalls.length > 0 && (
            <>
              <h3 style={{ marginTop:18, color:'#e74c3c' }}>⚠️ Shifts Under Minimum</h3>
              {result.shortfalls.map(sf => (
                <div key={sf.shiftId} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'rgba(231,76,60,.1)', borderRadius:4, marginTop:6 }}>
                  <span style={{ fontWeight:600 }}>{sf.shiftId}: {sf.role}</span>
                  <span style={{ color:'#e74c3c', fontWeight:700 }}>{sf.actual} / {sf.target}</span>
                </div>
              ))}
            </>
          )}

          <h3 style={{ marginTop:20 }}>Shift Distribution</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, marginBottom:12 }}>
            {Object.entries(roleColors).map(([k,c]) => (
              <span key={k}><span style={{ display:'inline-block', width:12, height:12, background:c, borderRadius:2, marginRight:4, verticalAlign:'middle' }} />{k==='internalServices'?'Internal Services':k[0].toUpperCase()+k.slice(1)}</span>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
            {days.map((dlabel, di) => {
              const max = Math.max(...slotKeys.map(sk => { const c = result.shiftRoleCounts[`D${di+1}${sk}`]; return c.filer+c.mentor+c.frontline+c.internalServices; }));
              return (
                <div key={di} style={{ background:'rgba(0,0,0,.03)', borderRadius:8, padding:12 }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>{dlabel}</div>
                  {slotKeys.map((sk, si) => {
                    const c = result.shiftRoleCounts[`D${di+1}${sk}`];
                    const total = c.filer+c.mentor+c.frontline+c.internalServices;
                    return (
                      <div key={sk} style={{ marginBottom:6 }}>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>{slotLabels[si]} ({total})</div>
                        <div style={{ display:'flex', height:22, borderRadius:4, overflow:'hidden', background:'rgba(0,0,0,.08)' }}>
                          {Object.entries(roleColors).map(([k,col]) => c[k] > 0 && (
                            <div key={k} style={{ width:`${(c[k]/max)*100}%`, background:col, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{c[k]}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FormSection title="✏️ Schedule Editor" subtitle="Search for a volunteer to manually adjust their shift assignments.">
        <Field label="Volunteer Name">
          <select onChange={e => setEditing(e.target.value || null)} value={editing || ''}>
            <option value="">Start typing a volunteer name…</option>
            {vols.map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        {editing && (
          <div style={{ marginTop:14 }}>
            <h3 style={{ marginBottom:8 }}>Editing: {editing}</h3>
            <table className="data-table">
              <thead><tr><th>Shift</th>{days.map((d,i) => <th key={i}>Day {i+1}</th>)}</tr></thead>
              <tbody>
                {slotLabels.map((lbl, si) => (
                  <tr key={lbl}>
                    <td style={{ fontWeight:600, textAlign:'left' }}>{lbl}</td>
                    {days.map((_, di) => (
                      <td key={di} style={{ textAlign:'center' }}><input type="checkbox" defaultChecked={Math.random() > .6} style={{ width:18, height:18, accentColor:'var(--accent)' }} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <label style={{ display:'flex', gap:10, alignItems:'center', marginTop:12 }}>
              <input type="checkbox" style={{ width:18, height:18 }} /> Send schedule update email to this volunteer
            </label>
            <div className="hstack mt">
              <button className="btn primary">Save Changes</button>
              <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </FormSection>
    </>
  );
}

function Stats() {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Returns filed (2026)" value="642" delta="+18% vs 2025" />
        <StatCard label="Refund processed" value="$812k" delta="avg $1,264 / client" />
        <StatCard label="T2202 students served" value="418" />
        <StatCard label="Newcomer ITNs applied" value="37" />
      </div>
      <div className="form-section">
        <h2>Returns by volunteer role</h2>
        <div className="mt">
          <BarChart data={[['Filer', 312], ['Mentor', 104], ['Frontline', 184], ['Internal', 42]]} />
        </div>
      </div>
      <div className="form-section">
        <h2>Client situations served</h2>
        <div className="mt">
          <BarChart data={[['Students', 418], ['Newcomers', 112], ['Seniors', 58], ['Families', 54]]} />
        </div>
      </div>
    </>
  );
}

function Intake() {
  const [saved, setSaved] = useStateD(false);
  return (
    <>
      <h2>Walk-in Intake</h2>
      <p className="muted">Log a new client and place them in the queue.</p>
      <FormSection title="Client info">
        <div className="form-row">
          <Field label="First name"><input placeholder="First" /></Field>
          <Field label="Last name"><input placeholder="Last" /></Field>
          <Field label="Preferred language"><select><option>English</option><option>Français</option><option>Mandarin</option><option>Arabic</option></select></Field>
        </div>
        <div className="form-row">
          <Field label="Taxpayer status"><select><option>Individual</option><option>Couple</option><option>With dependants</option></select></Field>
          <Field label="Filing year"><input defaultValue="2025" /></Field>
          <Field label="International?"><select><option>No</option><option>Yes — has SIN</option><option>Yes — needs ITN</option></select></Field>
        </div>
      </FormSection>
      <FormSection title="Situation flags">
        <div className="form-row">
          {['T2202 tuition','Newcomer','Senior 65+','Dependants','Rental sublet','Medical receipts'].map(x => (
            <label key={x} style={{ display:'flex', alignItems:'center', gap:8, fontSize:14 }}><input type="checkbox" /> {x}</label>
          ))}
        </div>
      </FormSection>
      <div className="hstack">
        <button className="btn primary" onClick={() => { setSaved(true); setTimeout(()=>setSaved(false), 2400); }}>Add to queue</button>
        <button className="btn secondary">Cancel</button>
      </div>
      {saved && <Toast msg="✅ Client added to queue" />}
    </>
  );
}

Object.assign(window, { QueueDashboard, VolunteerManagement, Schedule, Coverage, Stats, Intake });
