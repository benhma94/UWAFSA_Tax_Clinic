/**
 * Queue Dashboard App Entry Point
 * This is the entry point for the Queue Dashboard web app deployment
 */

/**
 * Entry point for Queue Dashboard web app
 * @returns {HtmlOutput} The HTML output for the queue dashboard
 */
function doGetQueueDashboard() {
  return HtmlService.createTemplateFromFile('queue_dashboard')
    .evaluate()
    .setTitle('Tax Clinic Queue Master Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets queue data with caching for improved performance
 * @returns {Object} Object containing queue and volunteers data
 */
function getQueueDataCached() {
  return getCachedOrFetch(
    CACHE_CONFIG.KEYS.QUEUE,
    () => {
      return {
        queue: getClientQueue(),
        volunteers: getSignedInVolunteers()
      };
    },
    CACHE_CONFIG.TTL.QUEUE
  );
}
