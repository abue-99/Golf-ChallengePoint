# Scripts

## Production Deployment — `deploy.sh`

**Always use this script to deploy or redeploy the stack on the production server.**

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

It performs five steps:
1. `git pull` to get the latest code (skip with `--skip-pull`)
2. Starts the `postgres` container and waits for it to be healthy
3. **Syncs the postgres password** — runs `ALTER USER … PASSWORD` inside the container using the local trust connection (no old password needed). This is what prevents the recurring P1000 / 28P01 "password authentication failed" error.
4. Starts the full stack (`docker compose up -d`)
5. Prints the service status

### Why the password sync is needed

PostgreSQL only reads `POSTGRES_PASSWORD` when the data directory is **first initialised**. If the `postgres_data` volume already exists (e.g. after `docker compose down` without `-v`), subsequent restarts silently ignore the env-var and keep the old password. Any mismatch between the stored password and `DATABASE_URL` causes Prisma error P1000.

`deploy.sh` fixes this on every deploy so it can never come back.

---

## Manual password fix — `fix-db-auth.sh`

If the stack is already partially running and you only need to reset the password:

```bash
chmod +x scripts/fix-db-auth.sh
./scripts/fix-db-auth.sh
```

After it completes, restart the full stack:

```bash
docker compose up -d
```

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
