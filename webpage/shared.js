// Shared header, nav, and footer for Tax Clinic public pages.
// Include at end of <body>; targets placeholder <div id="site-*"> elements.

(function() {
  console.log('Ah! You found my Easter Egg!\n\nThis website was redesigned by Ben Ma, CPA, CFA, CFP, PhD Student at the University of Toronto. He is the unofficial Webmaster, Administrator, Organizer, and many other unofficial titles at the UWAFSA Tax Clinic.\nFind more on him here: https://benma.ca');

  var HEADER = '<header>\n  <a href="https://uwafsa.com/">\n    <img src="images/logo.png" alt="Accounting &amp; Finance Student Association" />\n  </a>\n</header>';

  var NAV = '<nav>\n  <button class="nav-toggle" aria-label="Toggle navigation">&#9776;</button>\n  <ul>\n    <li><a href="/">Eligibility and Details</a></li>\n    <li><a href="/checklist.html">Checklist</a></li>\n    <li><a href="/about.html">About Us</a></li>\n    <li><a href="/FAQ.html">FAQ</a></li>\n    <li><a href="/PostFiling.html">Post Tax Return Filing</a></li>\n    <li><a href="/volunteerapplications.html">Volunteer Applications</a></li>\n    <li><a href="/training-wiki.html">Training Wiki</a></li>\n  </ul>\n  <form class="nav-search" action="search.html" method="get"><input type="search" name="q" placeholder="Search\u2026" aria-label="Search this site"><button type="submit" aria-label="Search">&#128269;</button></form>\n</nav>';

  var FOOTER = '<footer>\n  <a href="#top">Back to Top</a> |\n  <a href="https://instagram.com/uwafsa" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a> |\n  <a href="mailto:taxclinic@uwafsa.com" aria-label="Email"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></a>\n</footer>\n<!-- Ah! You found my Easter Egg!\n\n     This website was redesigned by Ben Ma, CPA, CFA, CFP, PhD Student at the University of Toronto. He is the unofficial Webmaster, Administrator, Organizer, and many other unofficial titles at the UWAFSA Tax Clinic.\n     Find more on him here: https://benma.ca\n-->';

  function inject(id, html) {
    var el = document.getElementById(id);
    if (el) el.outerHTML = html;
  }

  inject('site-header', HEADER);
  inject('site-nav', NAV);
  inject('site-footer', FOOTER);

  // Wire nav toggle (querySelector works after injection since outerHTML is sync)
  var toggle = document.querySelector('.nav-toggle');
  var navList = document.querySelector('nav ul');
  if (toggle && navList) {
    toggle.addEventListener('click', function() {
      navList.classList.toggle('nav-open');
    });
  }

  // Mark current page nav link as active
  var path = window.location.pathname;
  document.querySelectorAll('nav a').forEach(function(a) {
    var href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/') || (href !== '/' && path.endsWith(href))) {
      a.classList.add('active');
    }
  });

  // Page exit fade before navigation
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
        href.startsWith('http') || link.target === '_blank' || link.hasAttribute('download')) return;
    e.preventDefault();
    var content = document.getElementById('content');
    if (content) {
      content.style.transition = 'opacity 0.2s ease-in';
      content.style.opacity = '0';
    }
    setTimeout(function() { window.location.href = href; }, 210);
  });

  // Dark mode toggle
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark-mode');
  }
  var _dmBtn = document.createElement('button');
  _dmBtn.className = 'dark-mode-btn';
  _dmBtn.setAttribute('aria-label', 'Toggle dark mode');
  _dmBtn.title = 'Toggle dark mode';

  // SVG icons
  var sunSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var moonSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  _dmBtn.innerHTML = document.documentElement.classList.contains('dark-mode') ? sunSvg : moonSvg;
  _dmBtn.addEventListener('click', function() {
    var isDark = document.documentElement.classList.toggle('dark-mode');
    _dmBtn.innerHTML = isDark ? sunSvg : moonSvg;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
  document.body.appendChild(_dmBtn);
})();
