// Shared header, nav, and footer for Tax Clinic public pages.
// Include at end of <body>; targets placeholder <div id="site-*"> elements.

(function() {
  var HEADER = '<header>\n  <a href="https://uwafsa.com/">\n    <img src="images/logo.png" alt="Accounting &amp; Finance Student Association" />\n  </a>\n</header>';

  var NAV = '<nav>\n  <button class="nav-toggle" aria-label="Toggle navigation">&#9776;</button>\n  <ul>\n    <li><a href="/">Eligibility and Details</a></li>\n    <li><a href="/about.html">About Us</a></li>\n    <li><a href="/FAQ.html">FAQ</a></li>\n    <li><a href="/PostFiling.html">Post Tax Return Filing</a></li>\n    <li><a href="/volunteerapplications.html">Volunteer Applications</a></li>\n  </ul>\n  <form class="nav-search" action="search.html" method="get"><input type="search" name="q" placeholder="Search\u2026" aria-label="Search this site"><button type="submit" aria-label="Search">&#128269;</button></form>\n</nav>';

  var FOOTER = '<footer>\n  <a href="#top">Back to Top</a> |\n  <a href="https://instagram.com/uwafsa" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a> |\n  <a href="mailto:taxclinic@uwafsa.com" aria-label="Email"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></a>\n</footer>';

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
})();
