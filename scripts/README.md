# Scripts

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
