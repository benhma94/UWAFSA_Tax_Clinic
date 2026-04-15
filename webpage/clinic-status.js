// Live public clinic status polling for the public website.
// This file is intentionally page-specific and is only included on pages that display the status panel.
(function() {
  function getClinicStatusEndpoint() {
    if (window.CATBUS_CONFIG && CATBUS_CONFIG.WEBAPP_URL) {
      return CATBUS_CONFIG.WEBAPP_URL + '?action=getPublicClinicStatus';
    }
    return '/catbus?action=getPublicClinicStatus';
  }

  function initPublicClinicStatus() {
    var endpoint = getClinicStatusEndpoint();
    var navPill = document.getElementById('clinic-status-nav');
    var homePanelMount = document.getElementById('clinic-status-home') || document.getElementById('clinic-status-panel');

    if ((!navPill && !homePanelMount) || typeof fetch !== 'function') return;

    var timerId = null;
    var basePollMs = 90000;
    var maxPollMs = 300000;
    var failureCount = 0;

    function clearTimer() {
      if (!timerId) return;
      clearTimeout(timerId);
      timerId = null;
    }

    function scheduleNext(success) {
      clearTimer();
      if (document.hidden) return;

      var jitterMs = Math.floor(Math.random() * 2000);
      var delayMs = success
        ? basePollMs + jitterMs
        : Math.min(maxPollMs, basePollMs * Math.pow(2, failureCount)) + jitterMs;

      timerId = setTimeout(fetchAndRenderStatus, delayMs);
    }

    function applyStatusUi(data) {
      var status = data && data.status === 'open' ? 'open' : 'closed';
      var navText = status === 'open' ? 'Status: Open now' : 'Status: Closed';
      var queueLabel = data && data.queueSignal && data.queueSignal.label ? data.queueSignal.label : 'Queue updating';
      var volunteerLabel = data && data.volunteerSignal && data.volunteerSignal.label ? data.volunteerSignal.label : 'Volunteer availability updating';

      if (navPill) {
        navPill.classList.remove('clinic-status-pill--loading', 'clinic-status-pill--open', 'clinic-status-pill--closed');
        navPill.classList.add(status === 'open' ? 'clinic-status-pill--open' : 'clinic-status-pill--closed');
        navPill.textContent = navText;
      }

      if (homePanelMount) {
        var lastUpdatedText = data && data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : '';
        var nextClinicDate = data && data.nextClinicDate ? data.nextClinicDate : 'No upcoming clinic date published';
        var nextClinicHtml = status === 'closed'
          ? '<p class="clinic-status-home-meta">Next clinic: ' + escapeHtml(nextClinicDate) + '</p>'
          : '';
        var updatedHtml = lastUpdatedText
          ? '<p class="clinic-status-home-meta">Updated: ' + escapeHtml(lastUpdatedText) + '</p>'
          : '';

        homePanelMount.className = 'clinic-status-home is-' + status;
        homePanelMount.innerHTML =
          '<p class="clinic-status-home-title">Live Tax Clinic status</p>' +
          '<p class="clinic-status-home-message">' + escapeHtml((data && data.message) || 'Clinic status is currently unavailable.') + '</p>' +
          '<p class="clinic-status-home-meta">Queue: ' + escapeHtml(queueLabel) + ' | Volunteers: ' + escapeHtml(volunteerLabel) + '</p>' +
          nextClinicHtml +
          updatedHtml;
      }
    }

    function showUnavailableUi() {
      if (navPill) {
        navPill.classList.remove('clinic-status-pill--open', 'clinic-status-pill--closed');
        navPill.classList.add('clinic-status-pill--loading');
        navPill.textContent = 'Status: updating...';
      }

      if (homePanelMount) {
        homePanelMount.className = 'clinic-status-home is-closed';
        homePanelMount.innerHTML =
          '<p class="clinic-status-home-title">Live clinic status</p>' +
          '<p class="clinic-status-home-message">Clinic status is temporarily unavailable. Please refresh shortly.</p>';
      }
    }

    function fetchAndRenderStatus() {
      if (document.hidden) return;

      fetch(endpoint, { cache: 'no-store' })
        .then(function(response) {
          if (!response.ok) throw new Error('Status request failed');
          return response.json();
        })
        .then(function(payload) {
          failureCount = 0;
          applyStatusUi(payload || {});
          scheduleNext(true);
        })
        .catch(function(err) {
          failureCount += 1;
          console.warn('Public clinic status polling failed:', err);
          showUnavailableUi();
          scheduleNext(false);
        });
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    fetchAndRenderStatus();

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        clearTimer();
        return;
      }
      fetchAndRenderStatus();
    });
  }

  initPublicClinicStatus();
})();
