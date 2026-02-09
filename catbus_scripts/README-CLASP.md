# CATBUS - Clasp Setup Guide

This folder is configured to sync with your Google Apps Script project using clasp.

## Quick Start

### First Time Setup

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Install with default settings

2. **Run the setup script**
   - Double-click `setup-clasp.bat`
   - Follow the prompts to login to your Google account

3. **Enable Google Apps Script API**
   - Go to: https://script.google.com/home/usersettings
   - Turn ON "Google Apps Script API"

### Daily Usage

#### Upload Local Changes to Google Apps Script
- Double-click `upload.bat`
- This will push all your `.gs` and `.html` files to your Google Apps Script project

#### Download Changes from Google Apps Script
- Double-click `download.bat`
- This will pull all files from your Google Apps Script project
- **WARNING:** This overwrites local files!

## Manual Commands

If you prefer using the command line:

```bash
# Navigate to the scripts folder
cd "c:\Users\katma\Dropbox\Tax Clinic\Website\catbus_scripts"

# Upload your changes
clasp push

# Download from Google
clasp pull

# Open the project in browser
clasp open

# View deployment info
clasp deployments
```

## Project Info

- **Script ID:** 1Bf-iqnaUk5BADJbNWOCYEHDoWoxt-nMSn1-4AUps6QTSnFlwpsTT6SP5
- **Project Type:** Standalone Apps Script Project
- **Project URL:** https://script.google.com/home/projects/1Bf-iqnaUk5BADJbNWOCYEHDoWoxt-nMSn1-4AUps6QTSnFlwpsTT6SP5
- **Connected Spreadsheet ID:** 1W669LwuA8IpB03BlmhwnUkkupMZW2Cg0I_6cvSp0pwI

## Files Synced

The following files will be synced:
- `*.gs` - All Google Apps Script files
- `*.html` - All HTML files
- `appsscript.json` - Project manifest

Files ignored (see `.claspignore`):
- `.clasp.json` - Local configuration
- `README.md` and other markdown files
- `node_modules/`
- `.git/`

## Troubleshooting

### "Google Apps Script API has not been used"
- Go to https://script.google.com/home/usersettings
- Turn ON "Google Apps Script API"

### "User has not enabled the Apps Script API"
- Same solution as above

### "Access Not Configured"
- Make sure you're logged in: `clasp login`
- Check that you're using the correct Google account

### "Push failed"
- Make sure `.clasp.json` has the correct Script ID
- Try logging in again: `clasp login`

### "Permission denied"
- You may need to authorize clasp again
- Run: `clasp login --creds creds.json` (if you have a creds file)

## Best Practices

1. **Always pull before editing** if you've made changes in the online editor
2. **Test in the online editor** before deploying to production
3. **Commit to git** after successful uploads (if using version control)
4. **Use meaningful commit messages** when pushing to Google

## Links

- Clasp Documentation: https://github.com/google/clasp
- Apps Script Documentation: https://developers.google.com/apps-script
- Your Script Project: https://script.google.com/home/projects/1Bf-iqnaUk5BADJbNWOCYEHDoWoxt-nMSn1-4AUps6QTSnFlwpsTT6SP5
