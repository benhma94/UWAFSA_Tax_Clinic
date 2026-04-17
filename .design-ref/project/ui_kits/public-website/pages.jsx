// Page compositions
const { useState: useStateP } = React;

function HomePage({ status, setStatus }) {
  return (
    <>
      <ClinicStatusPanel status={status} />
      <div style={{ display:'flex', gap:8, margin:'0 0 18px' }}>
        <span style={{ fontFamily:'Lexend', fontSize:'.72rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-secondary)', fontWeight:600, alignSelf:'center', marginRight:6 }}>Status demo:</span>
        {['open','closed','loading'].map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`btn ${status===s?'':'ghost'}`} style={{ padding:'4px 12px', fontSize:12 }}>{s}</button>
        ))}
      </div>
      <h2 id="clinic-dates"><strong>Tax Clinic 2026</strong></h2>
      <ScheduleTable />
      <Callout>
        <p>It is not required to book an appointment — we generally work on a <strong>walk-in basis</strong>. If your situation is complex, use our <a href="#">screening tool</a>.</p>
        <p><strong>To help prepare your return, use our checklist.</strong></p>
        <p style={{ margin:'10px 0 4px' }}><a className="btn" href="#">Download Checklist (PDF)</a></p>
        <p>Questions? Email us at <a href="mailto:taxclinic@uwafsa.com">taxclinic@uwafsa.com</a>.</p>
      </Callout>
      <hr className="section-divider" />
      <SectionHeading id="eligibility">Eligibility</SectionHeading>
      <p><strong>Regrettably, we will not be able to prepare your return if it involves any of the following items:</strong></p>
      <ul className="ineligible-list">
        <li><p>Self-employed (including 'independent contractors', Uber, Doordash)</p></li>
        <li><p>Rental income (excluding sublet of a property you are renting)</p></li>
        <li><p>Interest income over $1,200 (except those claiming a T2202 tuition credit)</p></li>
        <li><p>A foreign investment property worth more than $100,000</p></li>
        <li><p>Disposition of marketable securities (eg. capital gains/losses on shares)</p></li>
        <li><p>Employment expenses (eg. form T2200 signed by your employer)</p></li>
        <li><p>Bankruptcy</p></li>
        <li><p>Deceased persons</p></li>
      </ul>
      <table>
        <thead><tr><th>Taxpayer Status</th><th>Family Income</th></tr></thead>
        <tbody>
          <tr><td>Individual</td><td>$40,000</td></tr>
          <tr><td>Couple</td><td>$55,000</td></tr>
          <tr><td>Each additional dependant</td><td>+$5,000</td></tr>
        </tbody>
      </table>
      <SectionHeading>International Students</SectionHeading>
      <p>International students are welcome and encouraged to file a tax return even if they don't have any income! We will walk you through the process of getting an Individual Tax Number (ITN) if you're not eligible for a Social Insurance Number (SIN) and don't already have an ITN.</p>
    </>
  );
}

function FAQPage() {
  return (
    <>
      <h2>Frequently Asked Questions</h2>
      <p>Answers to the questions we get most often. Can't find yours? Email <a href="mailto:taxclinic@uwafsa.com">taxclinic@uwafsa.com</a>.</p>
      <FaqCategory title="Our Services" defaultOpen>
        <FaqItem q="Can I book an appointment with you?" defaultOpen>
          <p><strong>No appointment necessary!</strong> We generally operate on a walk-in basis. If your situation is complex, use our screening tool to determine if an appointment is advisable.</p>
        </FaqItem>
        <FaqItem q="Do I need to be a UW student?">
          <p>Absolutely not — we do not restrict our services to University of Waterloo students. We welcome anyone in the Kitchener-Waterloo area who meets our eligibility criteria.</p>
        </FaqItem>
        <FaqItem q="Do you offer online services?">
          <p>Due to resource contraints, this is not a service we can provide. All filings happen in-person during our scheduled clinic dates.</p>
        </FaqItem>
      </FaqCategory>
      <FaqCategory title="Eligibility">
        <FaqItem q="I'm self-employed — can you still file for me?">
          <p>For tax purposes this is considered self-employment income. Unfortunately, we are unable to assist with returns that include self-employment income, including Uber, DoorDash, or independent contracting work.</p>
        </FaqItem>
        <FaqItem q="I'm an international student with no income. Should I still file?">
          <p>Yes! International students are welcome and encouraged to file a tax return even if they don't have any income.</p>
        </FaqItem>
      </FaqCategory>
      <FaqCategory title="Preparing for Your Visit">
        <FaqItem q="What should I bring?">
          <p>See our <a href="#" onClick={e=>{e.preventDefault();window.__setPage('checklist')}}>checklist page</a> for the full list. At minimum: government-issued photo ID, your SIN or ITN, all T-slips, and your most recent Notice of Assessment.</p>
        </FaqItem>
      </FaqCategory>
    </>
  );
}

function ChecklistPage() {
  return (
    <>
      <h2>Preparing for Your Visit</h2>
      <p>Here's what to bring. If you've left stuff at home, come back another time with everything — it saves you a second trip.</p>
      <div className="tool-grid">
        <ToolCard title="Eligibility Screener" desc="Answer 5 questions to see if your situation fits our clinic." />
        <ToolCard title="Downloadable Checklist (PDF)" desc="Print or save the full intake checklist." />
        <ToolCard title="Book an appointment" desc="Only for complex cases — walk-ins are preferred." />
      </div>
      <SectionHeading>Bring to Tax Clinic</SectionHeading>
      <ul style={{ listStyle:'none', paddingLeft:4 }}>
        {[
          'Government-issued photo ID',
          'SIN or ITN (or be ready to apply for an ITN)',
          'T4, T4A, T5, T3, T2202 slips',
          '2024 Notice of Assessment',
          'Rent or property tax receipts (if applicable)',
          'Tuition receipts and transit pass info',
          'Donation receipts, medical receipts',
        ].map(it => (
          <li key={it} style={{ display:'flex', padding:'3px 0' }}>
            <span style={{ color:'#27ae60', fontWeight:700, marginRight:10 }}>✓</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <Callout>
        <p style={{ fontFamily:'Lexend', fontWeight:700, color:'var(--text-primary)' }}>What NOT to bring</p>
        <ul className="ineligible-list">
          <li><p>Home office expenses (we can't process these)</p></li>
          <li><p>Pay stubs (we need T-slips, not pay stubs)</p></li>
          <li><p>GST/HST Notice of Assessments</p></li>
        </ul>
      </Callout>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <h2>About Us</h2>
      <p>The UW AFSA Tax Clinic is a free, student-run tax filing clinic hosted by the Accounting & Finance Student Association at the University of Waterloo. We've served the KW community since 2009.</p>
      <SectionHeading>Our Impact</SectionHeading>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, margin:'10px 0 16px' }}>
        {[['~1,000','Clients per year'],['100+','Volunteers'],['15+','Years running']].map(([n,l]) => (
          <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border-color)', borderRadius:12, padding:16, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontFamily:'Lexend', fontWeight:700, fontSize:'2rem', color:'#980000', lineHeight:1 }}>{n}</div>
            <div style={{ fontSize:'.85rem', color:'var(--text-secondary)', marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>
      <p>Every volunteer is a current UW accounting or finance student, supervised on-site by CPA mentors. Returns are filed using UFILE Online under CRA's Community Volunteer Income Tax Program (CVITP).</p>
    </>
  );
}

function VolunteerPage() {
  const [sent, setSent] = useStateP(false);
  return (
    <>
      <h2>Volunteer with Us</h2>
      <p>Applications for the 2026 clinic are open. We're recruiting <strong>frontline associates</strong>, <strong>filers</strong>, and <strong>mentors</strong>. (Internal services roles are filled by invitation from the clinic leadership team.)</p>
      {sent ? (
        <Callout><p><strong>Thanks — application submitted.</strong> We'll be in touch within 2 weeks.</p></Callout>
      ) : (
        <form onSubmit={e => { e.preventDefault(); setSent(true); }} style={{ display:'grid', gap:14, maxWidth:560 }}>
          {[['Full name','Rayya Patel'],['UW email','rpatel@uwaterloo.ca'],['Program & year','AFM 3B']].map(([label,ph]) => (
            <div key={label}>
              <label style={{ display:'block', fontFamily:'Lexend', fontWeight:500, fontSize:13, color:'var(--text-primary)', marginBottom:6 }}>{label}</label>
              <input placeholder={ph} required style={{ width:'100%', padding:'8px 12px', border:'1px solid #CBD5E1', borderRadius:4, fontSize:14, background:'var(--surface)', color:'var(--text-primary)' }} />
            </div>
          ))}
          <div>
            <label style={{ display:'block', fontFamily:'Lexend', fontWeight:500, fontSize:13, color:'var(--text-primary)', marginBottom:6 }}>Role preference</label>
            <select style={{ width:'100%', padding:'8px 12px', border:'1px solid #CBD5E1', borderRadius:4, fontSize:14, background:'var(--surface)', color:'var(--text-primary)' }}>
              <option>Frontline associate</option><option>Filer</option><option>Mentor</option>
            </select>
          </div>
          <button className="btn" type="submit" style={{ justifySelf:'start' }}>Submit application</button>
        </form>
      )}
    </>
  );
}

function PostFilingPage() {
  return (
    <>
      <h2>After You File</h2>
      <p>Your return is filed — here's what happens next.</p>
      <SectionHeading>Set up direct deposit</SectionHeading>
      <p>The fastest way to get your refund is to sign up for direct deposit through CRA My Account or your bank's online portal.</p>
      <SectionHeading>Check your Notice of Assessment</SectionHeading>
      <p>You'll receive your NOA from the CRA by mail or in My Account within 2–8 weeks. Keep it — you'll need it for next year's filing and for RRSP contribution limits.</p>
      <SectionHeading>Benefits you may now receive</SectionHeading>
      <ul>
        <li>GST/HST Credit (quarterly)</li>
        <li>Canada Carbon Rebate</li>
        <li>Ontario Trillium Benefit</li>
        <li>Canada Workers Benefit (if eligible)</li>
      </ul>
    </>
  );
}

Object.assign(window, { HomePage, FAQPage, ChecklistPage, AboutPage, VolunteerPage, PostFilingPage });
