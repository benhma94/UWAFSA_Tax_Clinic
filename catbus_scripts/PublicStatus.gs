/**
 * Public clinic status helpers for the public website.
 * Returns a cache-backed summary of whether the clinic is open, how busy the queue looks,
 * and whether volunteer coverage is healthy enough to keep walk-ins flowing.
 */

function getPublicClinicStatus() {
  return safeExecute(() => {
    return getCachedOrFetch(
      CACHE_CONFIG.KEYS.PUBLIC_CLINIC_STATUS,
      buildPublicClinicStatus_,
      CACHE_CONFIG.TTL.PUBLIC_CLINIC_STATUS
    );
  }, 'getPublicClinicStatus');
}

function buildPublicClinicStatus_() {
  const now = new Date();
  const clinicDates = Array.isArray(ELIGIBILITY_CONFIG.CLINIC_DATES) ? ELIGIBILITY_CONFIG.CLINIC_DATES : [];
  const parsedDates = clinicDates
    .map(function(label) {
      const date = parseClinicDateLabel_(label);
      return {
        label: label,
        date: date,
        key: dateKey_(date)
      };
    })
    .filter(function(item) { return item.date && item.key; })
    .sort(function(a, b) { return a.date - b.date; });

  const todayKey = dateKey_(now);
  const todayClinic = parsedDates.find(function(item) { return item.key === todayKey; }) || null;
  const nextClinic = parsedDates.find(function(item) { return item.key >= todayKey; }) || null;

  const queue = getClientQueue() || [];
  const volunteers = getAvailableVolunteers() || [];
  const queueSignal = buildQueueSignal_(queue.length, volunteers.length);
  const volunteerSignal = buildVolunteerSignal_(volunteers.length);

  const clinicHours = parseClinicHours_(ELIGIBILITY_CONFIG.CLINIC_HOURS);
  const withinHours = todayClinic ? isWithinClinicHours_(now, todayClinic.date, clinicHours) : false;
  const open = !!todayClinic && withinHours && volunteers.length > 0;
  const status = open ? 'open' : 'closed';
  const statusLabel = open
    ? 'Open now'
    : (todayClinic && !withinHours ? 'Closed for now' : 'Closed');

  return {
    status: status,
    statusLabel: statusLabel,
    open: open,
    message: buildPublicStatusMessage_(open, todayClinic, nextClinic, queueSignal, volunteerSignal, clinicHours),
    queueSignal: queueSignal,
    volunteerSignal: volunteerSignal,
    lastUpdated: now.toISOString(),
    lastUpdatedLabel: Utilities.formatDate(now, CONFIG.TIMEZONE, 'MMMM d, yyyy h:mm a'),
    nextClinicDate: nextClinic ? nextClinic.label : null,
    nextClinicDateIso: nextClinic ? nextClinic.date.toISOString() : null,
    clinicHours: ELIGIBILITY_CONFIG.CLINIC_HOURS
  };
}

function buildPublicStatusMessage_(open, todayClinic, nextClinic, queueSignal, volunteerSignal, clinicHours) {
  if (open) {
    return 'The clinic is open. ' + queueSignal.label + ' and volunteer coverage looks ' + volunteerSignal.label.toLowerCase() + '.';
  }

  if (todayClinic && clinicHours) {
    return 'The clinic is closed right now. Today\'s hours are ' + ELIGIBILITY_CONFIG.CLINIC_HOURS + '.';
  }

  if (nextClinic) {
    return 'The clinic is closed. Next clinic date: ' + nextClinic.label + '.';
  }

  return 'The clinic season has ended for the year.';
}

function buildQueueSignal_(queueCount, volunteerCount) {
  if (queueCount <= 0) {
    return { key: 'clear', label: 'No one is waiting' };
  }

  const pressure = volunteerCount > 0 ? queueCount / volunteerCount : queueCount;
  if (queueCount <= 2 && pressure <= 1) {
    return { key: 'light', label: 'Light wait' };
  }
  if (queueCount <= 6 && pressure <= 2) {
    return { key: 'moderate', label: 'Moderate wait' };
  }
  return { key: 'heavy', label: 'Busy queue' };
}

function buildVolunteerSignal_(volunteerCount) {
  if (volunteerCount <= 0) {
    return { key: 'none', label: 'No volunteers signed in' };
  }
  if (volunteerCount <= 3) {
    return { key: 'limited', label: 'Limited coverage' };
  }
  if (volunteerCount <= 7) {
    return { key: 'steady', label: 'Steady coverage' };
  }
  return { key: 'strong', label: 'Strong coverage' };
}

function parseClinicDateLabel_(label) {
  if (!label) return null;
  const parsed = new Date(label);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey_(date) {
  if (!date || isNaN(date.getTime())) return null;
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function parseClinicHours_(hoursText) {
  const match = (hoursText || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  return {
    open: { hour: to24Hour_(parseInt(match[1], 10), match[3]), minute: parseInt(match[2], 10) },
    close: { hour: to24Hour_(parseInt(match[4], 10), match[6]), minute: parseInt(match[5], 10) }
  };
}

function to24Hour_(hour, meridiem) {
  const normalized = String(meridiem || '').toUpperCase();
  if (normalized === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function isWithinClinicHours_(now, clinicDate, clinicHours) {
  if (!clinicDate || !clinicHours) return false;
  const openTime = new Date(clinicDate);
  openTime.setHours(clinicHours.open.hour, clinicHours.open.minute, 0, 0);
  const closeTime = new Date(clinicDate);
  closeTime.setHours(clinicHours.close.hour, clinicHours.close.minute, 0, 0);
  return now >= openTime && now <= closeTime;
}