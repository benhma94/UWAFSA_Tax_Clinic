/**
 * Shared email helper functions for CATBUS.
 */

/**
 * Sends an email via MailApp with standard logging and retry/error handling.
 * @param {Object} options MailApp.sendEmail options
 * @param {string} [context] Operation context for logging
 * @returns {void}
 */
function sendEmail(options, context = 'sendEmail') {
  if (!options || !options.to || !options.subject) {
    throw new Error('Email options must include a recipient and subject');
  }

  const recipient = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const operationContext = `Email (${context})`;
  return safeExecute(function() {
    MailApp.sendEmail(options);
  }, operationContext);
}

/**
 * Builds simple HTML content from a template string using {{key}} placeholders.
 * Values are HTML-escaped by default.
 * @param {string} template The template string
 * @param {Object} values Key/value map for template replacement
 * @returns {string}
 */
function buildHtmlEmail(template, values) {
  if (template === null || template === undefined) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, function(match, key) {
    const value = values && values.hasOwnProperty(key) ? values[key] : '';
    return escapeHtmlServer(value);
  });
}
