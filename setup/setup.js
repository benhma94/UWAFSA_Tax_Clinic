#!/usr/bin/env node
/**
 * CATBUS Setup Installer
 * ======================
 * Interactive CLI to configure a fresh CATBUS installation.
 *
 * Requirements: Node.js >= 14, internet access (to install clasp if needed).
 * No npm dependencies — uses only Node.js built-ins.
 *
 * Usage:
 *   node setup/setup.js
 *   (or double-click run-setup.bat on Windows)
 */

'use strict';

const readline = require('readline');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT       = path.join(__dirname, '..');
const CATBUS_DIR      = path.join(REPO_ROOT, 'catbus_scripts');
const WEBPAGE_DIR     = path.join(REPO_ROOT, 'webpage');
const SECRETS_FILE    = path.join(CATBUS_DIR, '_Secrets.gs');
const CLASP_JSON_FILE = path.join(CATBUS_DIR, '.clasp.json');
const CONFIG_JS_FILE  = path.join(WEBPAGE_DIR, 'config.js');

// ─── ANSI Colors ──────────────────────────────────────────────────────────────

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

const C = {
  reset:  USE_COLOR ? '\x1b[0m'  : '',
  bold:   USE_COLOR ? '\x1b[1m'  : '',
  dim:    USE_COLOR ? '\x1b[2m'  : '',
  red:    USE_COLOR ? '\x1b[31m' : '',
  green:  USE_COLOR ? '\x1b[32m' : '',
  yellow: USE_COLOR ? '\x1b[33m' : '',
  blue:   USE_COLOR ? '\x1b[34m' : '',
  cyan:   USE_COLOR ? '\x1b[36m' : '',
};

// ─── Output Helpers ───────────────────────────────────────────────────────────

function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${C.cyan}${C.bold}╔${line}╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║  ${text}  ║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚${line}╝${C.reset}\n`);
}

function step(n, total, text) {
  console.log(`\n${C.blue}${C.bold}[${n}/${total}]${C.reset} ${C.bold}${text}${C.reset}`);
}

function info(text)  { console.log(`  ${C.cyan}i${C.reset}  ${text}`); }
function ok(text)    { console.log(`  ${C.green}✓${C.reset}  ${text}`); }
function warn(text)  { console.log(`  ${C.yellow}!${C.reset}  ${text}`); }
function err(text)   { console.log(`  ${C.red}✗${C.reset}  ${C.red}${text}${C.reset}`); }
function hint(text)  { console.log(`     ${C.dim}${text}${C.reset}`); }
function label(text) { console.log(`\n  ${C.yellow}${C.bold}${text}${C.reset}`); }

// ─── readline Interface ───────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Prompts for a string value. Shows the default in brackets if provided.
 * Returns the trimmed response, or the default if the user pressed Enter.
 */
function ask(question, defaultValue) {
  return new Promise((resolve) => {
    const defStr = (defaultValue !== undefined && defaultValue !== '')
      ? ` ${C.dim}[${defaultValue}]${C.reset}` : '';
    rl.question(`  ${C.bold}${question}${defStr}${C.reset}: `, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed !== '' ? trimmed : (defaultValue || ''));
    });
  });
}

/**
 * Prompts for yes/no. Returns true for y, false for n.
 */
function askYesNo(question, defaultYes = true) {
  const hint_str = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`  ${C.bold}${question}${C.reset} ${C.dim}(${hint_str})${C.reset}: `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

/**
 * Waits for the user to press Enter.
 */
function waitForEnter(msg) {
  return new Promise((resolve) => {
    rl.question(`  ${C.dim}${msg || 'Press Enter to continue...'}${C.reset}`, () => resolve());
  });
}

// ─── Command Execution ────────────────────────────────────────────────────────

/**
 * Runs a shell command synchronously, printing stdout/stderr live.
 * All clasp commands default to CATBUS_DIR as cwd.
 * Throws on non-zero exit.
 *
 * @param {string} command
 * @param {string} [cwd]
 * @returns {string} stdout + stderr combined
 */
function run(command, cwd) {
  const workDir = cwd || CATBUS_DIR;
  info(`Running: ${C.dim}${command}${C.reset}`);

  const result = spawnSync(command, {
    cwd: workDir,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    const msg = (result.stderr || '').trim() || `Exit code ${result.status}`;
    throw new Error(`Command failed: ${command}\n${msg}`);
  }

  return (result.stdout || '') + (result.stderr || '');
}

/**
 * Like run() but returns null instead of throwing on failure.
 */
function runSafe(command, cwd) {
  try { return run(command, cwd); } catch { return null; }
}

// ─── Output Parsers ───────────────────────────────────────────────────────────

/**
 * Extracts the web app URL and deployment ID from clasp deploy output.
 * The URL format is always: https://script.google.com/macros/s/{ID}/exec
 *
 * @param {string} output
 * @returns {{ deploymentId: string, webAppUrl: string } | null}
 */
function parseDeploymentOutput(output) {
  const m = output.match(/https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/);
  if (!m) return null;
  return { webAppUrl: m[0], deploymentId: m[1] };
}

/**
 * Extracts the first non-HEAD deployment ID from `clasp deployments` output.
 * Lines look like: - AKfycbXXX @1.
 *
 * @param {string} output
 * @returns {string | null}
 */
function parseDeploymentId(output) {
  let headId = null;
  for (const line of output.split('\n')) {
    const m = line.match(/^\s*-\s+([A-Za-z0-9_-]{10,})\s+@(\d+|HEAD)/);
    if (!m) continue;
    if (m[2] === 'HEAD') { headId = headId || m[1]; }
    else return m[1]; // prefer first numbered deployment
  }
  return headId;
}

// ─── File Generators ──────────────────────────────────────────────────────────

function generateSecretsGs(s) {
  return `/**
 * CATBUS Instance Secrets
 * Generated by setup/setup.js — DO NOT COMMIT.
 * This file is gitignored.
 */
const SECRETS = {
  // Main Google Spreadsheet ID (from the URL of your spreadsheet)
  SPREADSHEET_ID: '${s.SPREADSHEET_ID}',

  // External spreadsheet: Consolidated Volunteers list
  CONSOLIDATED_VOLUNTEERS_SHEET_ID: '${s.CONSOLIDATED_VOLUNTEERS_SHEET_ID}',

  // Google Drive folder ID for filer resume uploads
  RESUME_FOLDER_ID: '${s.RESUME_FOLDER_ID}',

  // Google Drive folder ID for quiz file uploads
  QUIZ_FOLDER_ID: '${s.QUIZ_FOLDER_ID}',

  // Clinic contact info
  CLINIC_EMAIL: '${s.CLINIC_EMAIL}',
  CLINIC_WEBSITE_URL: '${s.CLINIC_WEBSITE_URL}',

  // Google Form URL for appointment booking
  BOOKING_FORM_URL: '${s.BOOKING_FORM_URL}',

  // Web app deployment URL
  WEBAPP_URL: '${s.WEBAPP_URL}',

  // Password required to access admin-only pages
  ADMIN_PASSWORD: '${s.ADMIN_PASSWORD}',
};
`;
}

function generateClaspJson(scriptId) {
  return JSON.stringify({ scriptId, rootDir: '.' }, null, 2) + '\n';
}

function generateConfigJs(webAppUrl) {
  return `// CATBUS web app configuration.
// Generated by setup/setup.js — DO NOT COMMIT.
// Re-upload this file to your web server whenever you redeploy.
window.CATBUS_CONFIG = {
  WEBAPP_URL: '${webAppUrl}',
};
`;
}

// ─── Setup Steps ──────────────────────────────────────────────────────────────

function checkNodeVersion() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 16) {
    err(`Node.js >= 16 is required. You have ${process.version}.`);
    hint('Download from: https://nodejs.org/');
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);
}

async function ensureClaspInstalled() {
  const result = runSafe('clasp --version');
  if (result !== null) {
    ok(`clasp ${result.trim().split('\n')[0]}`);
    return;
  }

  warn('clasp is not installed or not on PATH.');
  const install = await askYesNo('Install clasp globally now? (requires npm)');
  if (!install) {
    err('clasp is required. Install it with: npm install -g @google/clasp');
    process.exit(1);
  }
  run('npm install -g @google/clasp', os.homedir());
  ok('clasp installed.');
}

async function ensureClaspLoggedIn() {
  info('Checking clasp login status...');

  // `clasp list` exits non-zero and prints an auth message if not logged in
  const result = runSafe('clasp list');
  const isLoggedIn = result !== null
    && !result.toLowerCase().includes('not logged in')
    && !result.toLowerCase().includes('could not read api credentials');

  if (isLoggedIn) {
    ok('Already logged in to Google via clasp.');
    return;
  }

  warn('Not logged in to Google via clasp.');
  info('A browser window will open for Google OAuth authorization.');
  info('After you authorize in the browser, the terminal will continue automatically.');
  console.log('');
  run('clasp login');
  ok('Logged in to Google.');
}

async function setupGasProject() {
  console.log('');
  info('You need a Google Apps Script project to deploy CATBUS into.');
  const createNew = await askYesNo('Create a new GAS project? (No = I have an existing Script ID)', true);

  if (createNew) {
    info('Running: clasp create --title "CATBUS" --type webapp --rootDir .');
    try {
      run('clasp create --title "CATBUS" --type webapp --rootDir .');
    } catch (e) {
      // clasp create fails if .clasp.json already exists — that's fine
      if (fs.existsSync(CLASP_JSON_FILE)) {
        warn('.clasp.json already exists — reading existing Script ID.');
      } else {
        throw e;
      }
    }

    const claspJson = JSON.parse(fs.readFileSync(CLASP_JSON_FILE, 'utf8'));
    ok(`GAS project created. Script ID: ${C.cyan}${claspJson.scriptId}${C.reset}`);
    return claspJson.scriptId;

  } else {
    label('Existing Script ID');
    hint('Find it in Apps Script: Project Settings > Script ID');
    hint('Format: 1Bf-iqnaUk5BADJbNWOC...');
    const scriptId = await ask('Script ID');
    if (!scriptId) { err('Script ID is required.'); process.exit(1); }

    fs.writeFileSync(CLASP_JSON_FILE, generateClaspJson(scriptId), 'utf8');
    ok(`Written .clasp.json with Script ID: ${C.cyan}${scriptId}${C.reset}`);
    return scriptId;
  }
}

async function collectSecrets() {
  console.log('');
  info('Enter your instance-specific configuration values.');
  info('Press Enter to accept a default shown in [brackets].');
  console.log('');

  label('SPREADSHEET_ID — Main Google Sheets database');
  hint('Step 1: Run create-sheets.gs in a new spreadsheet to create required sheet tabs.');
  hint('Step 2: Copy the ID from the spreadsheet URL:');
  hint('        docs.google.com/spreadsheets/d/  >THIS PART<  /edit');
  const SPREADSHEET_ID = await ask('Spreadsheet ID');
  if (!SPREADSHEET_ID) { err('Spreadsheet ID is required.'); process.exit(1); }

  label('CONSOLIDATED_VOLUNTEERS_SHEET_ID — Volunteer list spreadsheet');
  hint('Usually a separate spreadsheet maintained by your organization.');
  hint('Leave blank (or press Enter) to reuse the same spreadsheet for now.');
  const CONSOLIDATED_VOLUNTEERS_SHEET_ID = await ask('Consolidated Volunteers Sheet ID', SPREADSHEET_ID);

  label('RESUME_FOLDER_ID — Google Drive folder for volunteer resumes');
  hint('Create a folder in Google Drive, then copy its ID from the URL:');
  hint('        drive.google.com/drive/folders/  >THIS PART<');
  hint('Leave blank to skip — resumes will not upload until this is set.');
  const RESUME_FOLDER_ID = await ask('Resume Folder ID', '');

  label('QUIZ_FOLDER_ID — Google Drive folder for quiz file uploads');
  hint('Create a folder in Google Drive for volunteers to upload quiz screenshots.');
  hint('Copy its ID from the URL: drive.google.com/drive/folders/  >THIS PART<');
  hint('Leave blank to skip — quiz file uploads will not work until this is set.');
  const QUIZ_FOLDER_ID = await ask('Quiz Folder ID', '');

  label('CLINIC_EMAIL — Outgoing email address for the clinic');
  hint('Must be a Gmail or Google Workspace account that owns this Apps Script project.');
  const CLINIC_EMAIL = await ask('Clinic Email');
  if (!CLINIC_EMAIL) { err('Clinic email is required.'); process.exit(1); }

  label('CLINIC_WEBSITE_URL — Public website URL');
  hint('Appears in email footers and confirmation messages sent to clients.');
  const CLINIC_WEBSITE_URL = await ask('Clinic Website URL', 'https://your-clinic.example.com');

  label('BOOKING_FORM_URL — Google Form URL for appointment booking');
  hint('Public form for complex-case clients to book appointments.');
  hint('Leave blank to fill in later — walk-in intake still works without it.');
  const BOOKING_FORM_URL = await ask('Booking Form URL', '');

  label('ADMIN_PASSWORD — Password to access admin-only pages');
  hint('Required to open admin, alerts, messaging, productcodes, and signinout pages.');
  hint('Choose a strong password and share it with clinic admins only.');
  const ADMIN_PASSWORD = await ask('Admin Password');
  if (!ADMIN_PASSWORD) { err('Admin password is required.'); process.exit(1); }

  return {
    SPREADSHEET_ID,
    CONSOLIDATED_VOLUNTEERS_SHEET_ID,
    RESUME_FOLDER_ID,
    QUIZ_FOLDER_ID,
    CLINIC_EMAIL,
    CLINIC_WEBSITE_URL,
    BOOKING_FORM_URL,
    ADMIN_PASSWORD,
    WEBAPP_URL: '', // filled after first deploy
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner('CATBUS Setup Installer');

  console.log(`  ${C.bold}Welcome!${C.reset} This wizard configures a fresh CATBUS installation.`);
  console.log(`  It writes three files and deploys your web app automatically:\n`);
  console.log(`    ${C.dim}catbus_scripts/_Secrets.gs${C.reset}    instance secrets`);
  console.log(`    ${C.dim}catbus_scripts/.clasp.json${C.reset}    clasp project config`);
  console.log(`    ${C.dim}webpage/config.js${C.reset}             web app URL for static pages`);
  console.log(`\n  ${C.yellow}Estimated time: 5–10 minutes.${C.reset}\n`);

  const TOTAL = 8;

  // ── 1. Node version ──────────────────────────────────────────────────────────
  step(1, TOTAL, 'Checking Node.js version');
  checkNodeVersion();

  // ── 2. clasp ─────────────────────────────────────────────────────────────────
  step(2, TOTAL, 'Checking clasp');
  await ensureClaspInstalled();

  // ── 3. Google Apps Script API ────────────────────────────────────────────────
  step(3, TOTAL, 'Google Apps Script API');
  console.log('');
  warn('The Google Apps Script API must be enabled for your Google account.');
  hint('1. Open: https://script.google.com/home/usersettings');
  hint('2. Turn ON "Google Apps Script API"');
  console.log('');
  await waitForEnter('Press Enter once the API is enabled...');

  // ── 4. Google auth ───────────────────────────────────────────────────────────
  step(4, TOTAL, 'Google authentication');
  await ensureClaspLoggedIn();

  // ── 5. GAS project ───────────────────────────────────────────────────────────
  step(5, TOTAL, 'Google Apps Script project');
  const scriptId = await setupGasProject();

  // ── 6. Secrets ───────────────────────────────────────────────────────────────
  step(6, TOTAL, 'Configuration values');
  const secrets = await collectSecrets();

  // Write initial _Secrets.gs with empty WEBAPP_URL
  fs.writeFileSync(SECRETS_FILE, generateSecretsGs(secrets), 'utf8');
  ok(`Written catbus_scripts/_Secrets.gs (WEBAPP_URL placeholder)`);

  // ── 7. First push + deploy ───────────────────────────────────────────────────
  step(7, TOTAL, 'Initial push and deployment');

  console.log('');
  info('Pushing all files to Google Apps Script...');
  run('clasp push --force');
  ok('Push complete.');

  console.log('');
  info('Creating initial deployment...');
  let deployOutput;
  try {
    deployOutput = run('clasp deploy --description "CATBUS initial deployment"');
  } catch (e) {
    warn('Deploy command returned an error — attempting to recover...');
    deployOutput = runSafe('clasp deployments') || '';
  }

  let parsed = parseDeploymentOutput(deployOutput);

  if (!parsed) {
    warn('Could not parse deployment URL from output. Fetching deployment list...');
    const listOutput = runSafe('clasp deployments') || '';
    const deploymentId = parseDeploymentId(listOutput);

    if (!deploymentId) {
      warn('Could not auto-detect deployment URL.');
      info('To find it manually:');
      hint('1. Open https://script.google.com/home');
      hint('2. Open your CATBUS project > Deploy > Manage Deployments');
      hint('3. Copy the Web App URL');
      console.log('');
      const manualUrl = await ask('Paste your Web App URL');
      if (!manualUrl || !manualUrl.includes('/macros/s/')) {
        err('Invalid URL. Exiting setup.');
        process.exit(1);
      }
      const idMatch = manualUrl.match(/\/macros\/s\/([A-Za-z0-9_-]+)\//);
      parsed = {
        deploymentId: idMatch ? idMatch[1] : 'unknown',
        webAppUrl: manualUrl,
      };
    } else {
      parsed = {
        deploymentId,
        webAppUrl: `https://script.google.com/macros/s/${deploymentId}/exec`,
      };
    }
  }

  const { deploymentId, webAppUrl } = parsed;
  console.log('');
  ok(`Deployment ID: ${C.cyan}${deploymentId}${C.reset}`);
  ok(`Web App URL:   ${C.cyan}${webAppUrl}${C.reset}`);

  // ── 8. Finalize ──────────────────────────────────────────────────────────────
  step(8, TOTAL, 'Finalizing configuration');

  // Update _Secrets.gs with real WEBAPP_URL
  secrets.WEBAPP_URL = webAppUrl;
  fs.writeFileSync(SECRETS_FILE, generateSecretsGs(secrets), 'utf8');
  ok('Updated catbus_scripts/_Secrets.gs with WEBAPP_URL');

  // Write webpage/config.js
  if (fs.existsSync(WEBPAGE_DIR)) {
    fs.writeFileSync(CONFIG_JS_FILE, generateConfigJs(webAppUrl), 'utf8');
    ok('Written webpage/config.js with WEBAPP_URL');
  } else {
    warn('webpage/ directory not found — skipping config.js');
  }

  console.log('');
  info('Pushing final configuration...');
  run('clasp push --force');
  ok('Second push complete.');

  console.log('');
  info('Updating deployment with final configuration...');
  run(`clasp deploy --deploymentId ${deploymentId} --description "CATBUS setup complete"`);
  ok('Deployment updated.');

  // ── Success ──────────────────────────────────────────────────────────────────
  banner('Setup Complete!');

  console.log(`  ${C.green}${C.bold}CATBUS is deployed and ready.${C.reset}\n`);
  console.log(`  ${C.bold}Web App URL:${C.reset}     ${C.cyan}${webAppUrl}${C.reset}`);
  console.log(`  ${C.bold}Script ID:${C.reset}       ${C.cyan}${scriptId}${C.reset}`);
  console.log(`  ${C.bold}Deployment ID:${C.reset}   ${C.cyan}${deploymentId}${C.reset}`);
  console.log('');
  console.log(`  ${C.yellow}${C.bold}Save the values above — you will need them for future deployments.${C.reset}\n`);
  console.log(`  ${C.bold}Next steps:${C.reset}`);
  console.log(`  1. Update ${C.dim}Config.gs${C.reset} with your clinic dates, shift times, and income limits.`);
  console.log(`     ${C.dim}(SCHEDULE_CONFIG, INCOME_LIMITS, APPOINTMENT_CONFIG, SIGN_IN_OUT)${C.reset}`);
  console.log(`  2. If you changed income limits, sync them to both HTML files:`);
  console.log(`     ${C.dim}catbus_scripts/appointment_screening.html${C.reset}`);
  console.log(`     ${C.dim}webpage/appointment_screening.html${C.reset}`);
  console.log(`  3. Upload ${C.dim}webpage/config.js${C.reset} (and all files in ${C.dim}webpage/${C.reset}) to your public web server.`);
  console.log(`     ${C.dim}Re-upload config.js every time you redeploy — it contains the live URL.${C.reset}`);
  console.log(`  4. Add UFILE product codes to the ${C.dim}"UFILE Keys"${C.reset} sheet (Year, Key, 0 columns).`);
  if (!secrets.QUIZ_FOLDER_ID) {
    console.log(`  5. ${C.yellow}Create a Google Drive folder for quiz uploads and add its ID to${C.reset} ${C.dim}_Secrets.gs${C.reset} ${C.yellow}as QUIZ_FOLDER_ID.${C.reset}`);
  }
  console.log(`  6. Test: ${C.cyan}${webAppUrl}?app=intake${C.reset}  (client intake)`);
  console.log(`          ${C.cyan}${webAppUrl}?app=queue${C.reset}   (queue dashboard — needs admin password)`);
  console.log(`          ${C.cyan}${webAppUrl}?app=admin${C.reset}   (admin dashboard — needs admin password)`);
  console.log(`  7. For future pushes and deploys, use the ${C.dim}/push${C.reset} and ${C.dim}/deploy${C.reset} skills.`);
  hint(`clasp push && clasp deploy --deploymentId ${deploymentId} --description "..."`);
  console.log('');
  console.log(`  ${C.dim}See catbus_scripts/README-CLASP.md for the development workflow.${C.reset}\n`);

  rl.close();
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

main().catch((e) => {
  console.error(`\n${C.red}${C.bold}FATAL ERROR:${C.reset} ${C.red}${e.message}${C.reset}`);
  if (process.env.DEBUG) console.error(e.stack);
  else console.error(`  ${C.dim}Run with DEBUG=1 for a full stack trace.${C.reset}`);
  rl.close();
  process.exit(1);
});
