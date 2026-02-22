# Pre-Workshop Setup Verification

**Complete this before the workshop.** ~15 minutes. Catches Node/npm/compilation issues in advance.

## 1. Prerequisites

```bash
node --version   # must be 18+, v22.x recommended
npm --version    # any recent version
```

Install Temporal CLI if not already installed:

```bash
# macOS
brew install temporal

# Linux
curl -sSf https://temporal.download/cli.sh | sh
# then add `temporal` to PATH

# Verify
temporal --version
```

## 2. Clone the repo

```bash
git clone --recurse-submodules https://github.com/temporal-sa/sap-temporal-durable-ai-workshop.git
cd sap-temporal-durable-ai-workshop
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## 3. Install dependencies

```bash
cd intro-temporal-vercel-ai-tutorial
npm install
cd ..

cd temporal-dispute-resolution
npm install
cd ..
```

> **This is the most likely failure point.** `@temporalio/worker` includes platform-specific native binaries (SWC/Rust). If `npm install` fails, check your Node version and npm registry access.

## 4. Run Hello World (end-to-end verification)

This exercises TypeScript compilation, SWC workflow bundling, and Temporal connectivity.

**Terminal 1 — start Temporal dev server:**

```bash
temporal server start-dev
```

Expected output includes `Temporal server is running at localhost:7233` and UI at `http://localhost:8233`.

**Terminal 2 — start the worker** (in `intro-temporal-vercel-ai-tutorial/`):

```bash
cd intro-temporal-vercel-ai-tutorial
npm start
```

Expected: worker starts and logs something like:

```
INFO  Worker state changed { from: 'INITIALIZED', to: 'RUNNING' }
```

If you see errors about SWC, webpack, or native modules — see troubleshooting below.

**Terminal 3 — run the workflow** (in `intro-temporal-vercel-ai-tutorial/`):

```bash
cd intro-temporal-vercel-ai-tutorial
npm run workflow
```

Expected output:

```
Hello, Temporal!
```

You're set. Visit `http://localhost:8233` to see the completed workflow in the Temporal UI.

## Troubleshooting

**`npm install` fails with native module errors**
- Upgrade to Node 22.x: `nvm install 22 && nvm use 22`
- Corporate npm proxy: configure `.npmrc` or use `npm install --registry https://registry.npmjs.org`

**Worker fails to start with SWC/webpack errors**
- Run `npm install` again — native binaries are platform-specific and may need to be rebuilt
- Check Node version matches what was used at install time: `node --version`
- On Linux: ensure you're not on Alpine (musl libc incompatible) — use `node:22-bullseye` or similar

**`temporal: command not found`**
- macOS: `brew install temporal`
- Ensure `temporal` is in your PATH: `echo $PATH`

**Worker starts but workflow fails to connect**
- Confirm Temporal dev server is running on port 7233: `temporal server start-dev`
- Default namespace is `default` — no config needed for local dev
