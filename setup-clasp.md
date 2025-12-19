# CATBUS clasp Setup Guide

## Prerequisites

1. Install Node.js from https://nodejs.org/ (LTS version)
2. Restart your terminal after installation

## Installation Steps

### 1. Install clasp globally
```bash
npm install -g @google/clasp
```

### 2. Login to Google Account
```bash
clasp login
```
This will open your browser. Sign in with your Google account that has access to the Apps Script project.

### 3. Find Your Script ID

**Option A: From Apps Script Editor**
1. Open your CATBUS project in Apps Script: https://script.google.com
2. Click **Project Settings** (gear icon on left)
3. Copy the **Script ID**

**Option B: From the URL**
If your Apps Script URL looks like:
```
https://script.google.com/home/projects/1a2b3c4d5e6f7g8h9i0j/edit
```
Your Script ID is: `1a2b3c4d5e6f7g8h9i0j`

### 4. Clone Your Project
```bash
cd "c:\Users\Ben Ma\Dropbox\Tax Clinic\Website"
clasp clone YOUR_SCRIPT_ID_HERE
```

This creates a `.clasp.json` file with your project configuration.

### 5. Verify Setup
```bash
# List your files
clasp status

# Open in browser
clasp open
```

## Daily Workflow

### Editing Locally
1. Edit any `.gs` or `.html` file in VS Code
2. Save your changes

### Push to Apps Script
```bash
# Push all changes
clasp push

# Or push and watch for changes
clasp push --watch
```

### Pull from Apps Script
If you make changes in the online editor:
```bash
clasp pull
```

### Deploy New Version
```bash
# Create a new deployment
clasp deploy -d "v2.0 - Performance metrics and mobile improvements"

# List all deployments
clasp deployments
```

## Configuration Files

After cloning, you'll have these files:

### `.clasp.json`
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "catbus_scripts"
}
```

### `.claspignore` (create this to exclude files)
```
# Ignore these files when pushing
node_modules/**
.git/**
.gitignore
README.md
setup-clasp.md
webpage/**
.env
*.md
```

## Troubleshooting

### "Not logged in"
```bash
clasp login
```

### "Manifest file has been updated"
If you see this warning after pulling:
```bash
# This is normal - the manifest (appsscript.json) was updated
# Just review the changes and push if needed
```

### "Push failed"
- Make sure you're logged in: `clasp login`
- Check you're in the right directory
- Verify scriptId in `.clasp.json`

### Changes not appearing
- Wait a few seconds after `clasp push`
- Refresh the Apps Script editor
- Check for errors in `clasp push` output

## Advanced Tips

### Auto-push on save
```bash
clasp push --watch
```
Now every time you save a file, it automatically pushes to Apps Script!

### Push specific files only
```bash
clasp push --force
```

### Version Control with Git
```bash
# After making changes
clasp push                    # Push to Apps Script
git add .                     # Stage for Git
git commit -m "Add metrics"   # Commit to Git
git push                      # Push to GitHub/remote
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `clasp login` | Authenticate with Google |
| `clasp clone <scriptId>` | Download existing project |
| `clasp push` | Upload local changes to Apps Script |
| `clasp pull` | Download changes from Apps Script |
| `clasp open` | Open project in browser |
| `clasp deploy` | Create new deployment |
| `clasp logs` | View execution logs |
| `clasp status` | Show file sync status |

## Project Structure

```
c:\Users\Ben Ma\Dropbox\Tax Clinic\Website\
├── .clasp.json              # clasp configuration
├── .claspignore             # Files to exclude from push
├── README.md                # Project documentation
├── setup-clasp.md           # This file
└── catbus_scripts/          # Your Apps Script files
    ├── Config.gs
    ├── Utils.gs
    ├── RequestHandler.gs    # NEW: Consolidated requests
    ├── HelpRequests.gs
    ├── ReviewRequests.gs
    ├── AdminDashboard.gs    # NEW: With performance metrics
    ├── ... (all other .gs files)
    ├── admin_dashboard.html  # NEW: With metrics UI
    ├── queue_dashboard.html  # NEW: Mobile responsive
    └── ... (all other .html files)
```

## Next Steps

After setup, you can:
1. ✅ Edit files in VS Code with syntax highlighting
2. ✅ Use Git for version control
3. ✅ Push changes instantly with `clasp push --watch`
4. ✅ Deploy new versions from command line
5. ✅ Keep Dropbox sync for backup

Happy coding! 🚀
