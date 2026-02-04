/**
 * Version check endpoint
 */
function doGetVersionCheck() {
  const version = "2024-12-19-V102-DATE-SERIALIZATION-FIX";
  const html = HtmlService.createHtmlOutput(`
    <h1>CATBUS Version Check</h1>
    <p><strong>Version:</strong> ${version}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <p><strong>checkExistingVolunteer function exists:</strong> ${typeof checkExistingVolunteer === 'function' ? 'YES' : 'NO'}</p>
    <hr>
    <p>If you see this version, setTimeout has been removed from availability_form.html.</p>
  `);
  return html;
}

