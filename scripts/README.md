# Scripts

## Local development with a copy of production — `local-up.ps1` / `sync-prod-db.ps1`

For local development on Windows (Docker Desktop). Uses a **local Postgres**
container instead of Neon: faster, works behind company firewalls that block
Postgres traffic, and local tests or migrations never touch production.

```powershell
# 1. Start the stack with the local database (first run creates an empty DB)
.\scripts\local-up.ps1

# 2. Copy production data into it (via SSH to the production server)
.\scripts\sync-prod-db.ps1

# Follow API logs / stop (data is kept in the Docker volume golf_localdb)
.\scripts\local-up.ps1 -Logs
.\scripts\local-up.ps1 -Down
```

- App: <http://localhost:3000> – log in with your normal production credentials.
- Database for DBeaver/pgAdmin: `localhost:5433`, user `postgres`, password `postgres`, DB `challengepoint`.
- `sync-prod-db.ps1` only **reads** production: it runs `pg_dump` in a temporary
  container on the server, downloads the dump with `scp` and replaces the local
  DB. Options: `-Server root@host`, `-KeepDump` (keep `.localdb/prod.dump`),
  `-SkipDownload` (re-import a kept dump).
- The dump contains personal data. `.localdb/` is git-ignored and the dump is
  deleted after import unless `-KeepDump` is used.
- If PowerShell blocks the scripts: `powershell -ExecutionPolicy Bypass -File .\scripts\local-up.ps1`

---

## Production Deployment — `deploy.sh`

**Always use this script to deploy or redeploy the stack on the production server.**

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

It performs three steps:
1. `git pull` to get the latest code (skip with `--skip-pull`)
2. Starts the full stack (`docker compose up -d`)
3. Prints the service status

### Prerequisites

The `.env` file must contain a valid `DATABASE_URL` pointing to your managed
Postgres instance (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)):

```
DATABASE_URL="postgresql://user:password@host.neon.tech/challengepoint?sslmode=require"
```

No local Postgres container is needed — the API and web containers connect
directly to the managed database via `DATABASE_URL`.

---

## GitHub Automation (optional) — `gh_create_mvp_issues.sh`

Creates the EPIC + Sprint issues using the GitHub CLI.

### Requirements
- Install GitHub CLI: https://cli.github.com/
- Authenticate: `gh auth login`
- Permission to create issues in the target repo

### Usage
From the repo root:
```bash
bash scripts/gh_create_mvp_issues.sh OWNER/REPO
```

The script will create:
- 1 EPIC issue
- Sprint issues S0–S3

You can then assign milestones, add to GitHub Projects, and refine acceptance criteria.
