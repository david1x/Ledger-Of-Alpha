# Getting Started

This guide covers two ways to install and run Ledger Of Alpha: **locally with npm** (for development or personal use) and **with Docker** (for production or quick deployment).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option 1: Local Installation (npm)](#option-1-local-installation-npm)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Start the Development Server](#4-start-the-development-server)
  - [5. Production Build (Optional)](#5-production-build-optional)
- [Option 2: Docker](#option-2-docker)
  - [1. Clone the Repository](#1-clone-the-repository-1)
  - [2. Create Your Docker Compose File](#2-create-your-docker-compose-file)
  - [3. Configure Environment Variables](#3-configure-environment-variables-1)
  - [4. Build and Start](#4-build-and-start)
  - [5. Managing the Container](#5-managing-the-container)
- [First-Time Setup (Both Methods)](#first-time-setup-both-methods)
  - [Guest Mode](#guest-mode)
  - [Creating Your Account](#creating-your-account)
  - [Claiming Admin](#claiming-admin)
  - [Configuring App Settings](#configuring-app-settings)
- [Environment Variables Reference](#environment-variables-reference)
- [Database](#database)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local (npm)

| Requirement | Version |
|---|---|
| **Node.js** | 18 or higher |
| **npm** | Included with Node.js |

`better-sqlite3` is a native module — on most systems `npm install` handles compilation automatically. If it fails, make sure you have a C++ build toolchain installed:

- **Windows**: Install "Desktop development with C++" via [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- **macOS**: Run `xcode-select --install`
- **Linux (Debian/Ubuntu)**: `sudo apt install python3 make g++`

### Docker

| Requirement | Version |
|---|---|
| **Docker** | 20.10 or higher |
| **Docker Compose** | v2 (included with Docker Desktop) |

No Node.js installation needed — everything builds inside the Docker image.

---

## Option 1: Local Installation (npm)

### 1. Clone the Repository

```bash
git clone https://github.com/david1x/ledger-of-alpha.git
cd ledger-of-alpha
```

### 2. Install Dependencies

```bash
npm install
```

This installs all runtime and dev dependencies, including the native `better-sqlite3` bindings.

### 3. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor. At minimum, set the `JWT_SECRET`:

```env
# Generate a random secret (at least 32 characters):
#   Linux/macOS: openssl rand -base64 32
#   Windows PowerShell: [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
JWT_SECRET=your-generated-secret-here
```

SMTP settings are **optional** for local development. If not configured, verification emails are printed to the terminal instead of being sent — you can copy the verification link from there.

### 4. Start the Development Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

The SQLite database is created automatically at `data/ledger-of-alpha.db` on the first API request. No database setup or migration commands needed.

### 5. Production Build (Optional)

To build and run in production mode locally:

```bash
npm run build
npm run start
```

`npm run build` also runs TypeScript type-checking, so this doubles as a validation step.

### Stopping the Server

- **If running in the foreground**: Press `Ctrl+C`
- **If the process is stuck (Windows)**:
  ```powershell
  Stop-Process -Name node -Force
  ```
- **If the process is stuck (Linux/macOS)**:
  ```bash
  pkill -f "next dev"
  ```

---

## Option 2: Docker

### 1. Clone the Repository

```bash
git clone https://github.com/david1x/ledger-of-alpha.git
cd ledger-of-alpha
```

### 2. Create Your Docker Compose File

Copy the example configuration:

```bash
cp docker-compose.example.yml docker-compose.yml
```

> **Important**: `docker-compose.yml` is gitignored — your secrets won't be committed.

### 3. Configure Environment Variables

Open `docker-compose.yml` in your editor and update the `environment` section:

```yaml
environment:
  # Public URL — change to your domain if deploying remotely
  NEXT_PUBLIC_APP_URL: "http://localhost:3000"

  # JWT Secret — REQUIRED. Generate with: openssl rand -base64 32
  JWT_SECRET: "paste-your-generated-secret-here"

  # SMTP — REQUIRED for email verification in production.
  # Without SMTP, emails print to container logs (docker compose logs -f app).
  SMTP_HOST: "smtp.gmail.com"
  SMTP_PORT: "587"
  SMTP_SECURE: "false"
  SMTP_USER: "your@gmail.com"
  SMTP_PASS: "your-app-password"
  SMTP_FROM: "Ledger Of Alpha <noreply@your-domain.com>"
```

**Changing the port**: Edit the `ports` mapping and the `NEXT_PUBLIC_APP_URL` to match. For example, to run on port 3002:

```yaml
ports:
  - "3002:3002"
environment:
  NEXT_PUBLIC_APP_URL: "http://localhost:3002"
```

Then update the `PORT` environment variable in the Dockerfile or pass it as an env var:

```yaml
environment:
  PORT: "3002"
```

### 4. Build and Start

```bash
docker compose up -d --build
```

This runs a multi-stage Docker build:
1. **deps** — Installs Node.js dependencies + compiles native `better-sqlite3`
2. **builder** — Builds the Next.js production bundle (standalone output)
3. **runner** — Minimal Alpine image, runs as non-root `nextjs` user

Once complete, open the URL you configured (default: **http://localhost:3000**).

The SQLite database is stored in `./data/` on the host via the volume mount and persists across container restarts and rebuilds.

### 5. Managing the Container

```bash
# View live logs
docker compose logs -f app

# Stop the app
docker compose down

# Restart after code changes
docker compose up -d --build

# Check container health
docker compose ps
```

### Backing Up the Database

The SQLite database lives in `./data/` on the host. To back it up:

```bash
# Linux/macOS
cp -r ./data ./data-backup-$(date +%Y%m%d)

# Windows PowerShell
Copy-Item -Recurse ./data ./data-backup-$(Get-Date -Format yyyyMMdd)
```

---

## First-Time Setup (Both Methods)

### Guest Mode

Click **"Continue as Guest"** on the login page to explore immediately with pre-loaded demo trades. No account needed. Guest data is temporary and not persisted.

### Creating Your Account

1. Click **"Register"** on the login page
2. Enter your name, email, and password (minimum 8 characters)
3. **Verify your email**:
   - **With SMTP configured**: Check your inbox for the verification link
   - **Without SMTP (local dev)**: The verification link is printed to the terminal where the server is running. Copy and paste it into your browser.
   - **Without SMTP (Docker)**: Run `docker compose logs -f app` to see the link in the container output
4. After verifying, log in with your email and password

### Claiming Admin

The first registered user can claim admin privileges:

1. Log in to your account
2. Navigate to **/admin** in the URL bar
3. Click **"Claim Admin"** — this button only appears when no admin exists yet
4. You now have access to the Admin Panel where you can:
   - Manage users (view, toggle admin rights)
   - Configure SMTP settings from the UI (overrides environment variables)

### Configuring App Settings

Navigate to **Settings** (gear icon in the navbar) to configure:

| Setting | Required | Description |
|---|---|---|
| **Account Size** | Yes | Your trading account balance in USD (default: $10,000) |
| **Risk Per Trade** | Yes | Percentage of account risked per trade (default: 1%) |
| **FMP API Key** | Optional | Enables live symbol search autocomplete. Get a free key at [financialmodelingprep.com](https://financialmodelingprep.com/developer/docs) |
| **Discord Webhook** | Optional | Paste a Discord webhook URL to enable posting chart snapshots directly to a channel |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | — | Secret key for signing session tokens. Must be at least 32 characters. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public URL of the app. Used in verification email links. |
| `DB_PATH` | No | `data/ledger-of-alpha.db` | Override the SQLite database file path. |
| `SMTP_HOST` | No | — | SMTP server hostname (e.g., `smtp.gmail.com`). |
| `SMTP_PORT` | No | `587` | SMTP server port. |
| `SMTP_SECURE` | No | `false` | Set to `true` for SSL (port 465), `false` for STARTTLS (port 587). |
| `SMTP_USER` | No | — | SMTP username/email. |
| `SMTP_PASS` | No | — | SMTP password. For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833). |
| `SMTP_FROM` | No | `Ledger Of Alpha <noreply@ledgerofalpha.local>` | "From" address for outgoing emails. |

> **Note**: SMTP settings can also be configured from the Admin Panel (Settings tab) after claiming admin. Admin Panel settings override environment variables.

---

## Database

- **Engine**: SQLite via `better-sqlite3`
- **Location**: `data/ledger-of-alpha.db` (created automatically on first API call)
- **Migrations**: Run automatically on startup — no manual migration commands needed
- **Mode**: WAL (Write-Ahead Logging) for better concurrent read performance

The `data/` directory is gitignored. In Docker, it's mounted as a volume so the database persists across container rebuilds.

---

## Troubleshooting

### `npm install` fails on `better-sqlite3`

This native module requires a C++ compiler. Install the build toolchain for your OS (see [Prerequisites](#local-npm)).

### "Internal Server Error" (500) after deleting or renaming a page

Next.js caches page stubs in `.next/`. Clear the build cache:

```bash
# Linux/macOS
rm -rf .next

# Windows PowerShell
Remove-Item -Recurse -Force .next
```

Then restart the dev server.

### Verification email not arriving

- **Local dev without SMTP**: Emails print to the terminal — look for the verification URL in your console output
- **Docker without SMTP**: Run `docker compose logs -f app` and look for the email output
- **Gmail SMTP**: Make sure you're using an [App Password](https://support.google.com/accounts/answer/185833), not your account password. Regular passwords won't work if 2FA is enabled on your Google account.

### Port already in use

```bash
# Check what's using the port (Linux/macOS)
lsof -i :3000

# Check what's using the port (Windows PowerShell)
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
```

### Docker build fails on ARM (Apple Silicon, Raspberry Pi)

The `node:22-alpine` image and `better-sqlite3` both support ARM64 natively, so this should work out of the box. If you encounter issues, ensure Docker Desktop is up to date.

### Container keeps restarting

Check the logs for the error:

```bash
docker compose logs --tail=50 app
```

Common causes:
- Missing or invalid `JWT_SECRET` (must be at least 32 characters)
- Port conflict on the host
