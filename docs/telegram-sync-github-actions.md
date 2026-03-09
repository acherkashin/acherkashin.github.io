# Telegram Weekly Sync via GitHub Actions

## What this workflow does

The workflow `.github/workflows/telegram-weekly-sync.yml` runs the weekly Telegram pipeline manually from GitHub Actions:

1. Installs dependencies with `npm ci`.
2. Runs `npm run telegram:pipeline:week`.
3. Commits generated content changes (if any).
4. Pushes the commit to `main`.

It is configured as **manual-only** right now (`workflow_dispatch`).

## Future schedule (currently commented out)

The workflow includes this commented block for future automation:

```yaml
# schedule:
#   - cron: "0 16 * * 1,3,5" # Mon/Wed/Fri 19:00 Europe/Moscow (16:00 UTC)
```

GitHub cron uses UTC. `16:00 UTC` equals `19:00` in Europe/Moscow.

## GitHub secrets and variables setup

Open:

`Repository Settings -> Secrets and variables -> Actions`

### Required secrets

Create these repository secrets:

- `TG_API_ID` - Telegram API ID (numeric).
- `TG_API_HASH` - Telegram API hash.
- `TG_STRING_SESSION` - pre-generated Telegram string session.

### Optional variable

Create this repository variable only if you need channel override in CI:

- `TG_CHANNEL` - channel username (for example `@cherkashindev`).

If `TG_CHANNEL` is not set, script defaults are used.

## How to generate `TG_STRING_SESSION`

Run locally:

```bash
npm run telegram:session
```

Copy the generated session value into GitHub secret `TG_STRING_SESSION`.

## How to run manually

1. Open `Actions` tab in GitHub.
2. Select **Telegram Weekly Sync** workflow.
3. Click **Run workflow**.

## Branch and permissions notes

- The workflow pushes to `main` using `GITHUB_TOKEN`.
- Workflow permissions include `contents: write`.
- If branch protection blocks pushes from GitHub Actions, update branch protection to allow this workflow/bot push path.

## Expected outcomes

- If new/updated posts are generated: workflow creates commit `chore(posts): weekly telegram sync` and pushes to `main`.
- If no files changed: workflow exits successfully with `No changes to commit`.
- If required secrets are missing or invalid: workflow fails with clear script errors.
