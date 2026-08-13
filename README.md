# SAX 4 Miler Leaderboard

Hosted on Azure Static Web Apps from this repo:
https://leaderboard.saxadvisorygroup.com/

## Local preview
```bash
python3 -m http.server 8765
```

## Data source
Standings are built from the Marketing SharePoint workbook:

`Updated 4Miler Tracking.xlsx`  
https://saxllp.sharepoint.com/sites/Marketing/.../Updated%204Miler%20Tracking.xlsx

Partners (Eligibility = Partner) are excluded from the public leaderboard.

## Sync data from SharePoint
Requires Azure CLI login with access to the Marketing site:

```bash
az login --tenant a33e9b66-a6ef-43bf-9702-7cb4301d0a16
python3 scripts/sync_from_sharepoint.py
```

Or run the wrapper (sync + commit + push when changed):

```bash
./scripts/run_sharepoint_sync.sh
```

Logs: `logs/sharepoint-sync.log`

### Browser auto-update
`app.js` silently re-fetches `data.json` every 60 seconds (no full page reload) and when the tab becomes visible again.

### Scheduled sync
- **macOS LaunchAgent** (local, uses your `az` login): every 30 minutes  
  `~/Library/LaunchAgents/com.sax.4miler.sharepoint-sync.plist`
- **GitHub Actions** (optional cloud): `.github/workflows/sync-sharepoint-leaderboard.yml`  
  Needs Graph-capable Azure app secrets:
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_SUBSCRIPTION_ID` (OIDC) and/or `AZURE_CLIENT_SECRET`

## Deploy
Push to `main`. Workflow uses `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_MUSHROOM_05D784C0F`.
