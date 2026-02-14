# Temporal TypeScript Local Dev Setup

Source: [docs.temporal.io](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript) and [learn.temporal.io](https://learn.temporal.io/getting_started/typescript/dev_environment/)

## Prerequisites

- Node.js 18+ (v22.x recommended)
- npm (or pnpm/yarn)

## 1. Install Temporal CLI

```bash
# macOS
brew install temporal

# Linux — download from https://temporal.download/cli/archive/latest?platform=linux&arch=amd64
# Extract and add `temporal` to PATH
```

## 2. Start Dev Server

```bash
temporal server start-dev
```

- Temporal Service: `localhost:7233`
- Web UI: `http://localhost:8233`
- Creates default Namespace, uses in-memory DB

Options:
```bash
# Custom UI port
temporal server start-dev --ui-port 8080

# Persist data between restarts
temporal server start-dev --db-filename temporal.db
```

Leave running in a separate terminal.

## 3. Create a New TS Project

### Option A: Scaffold from template

```bash
npx @temporalio/create@latest ./my-app
# Select "hello-world" when prompted
cd my-app
```

### Option B: Add to existing project

```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

## 4. Project Structure

```
my-app/
├── src/
│   ├── activities.ts    # Activity definitions (side effects, I/O)
│   ├── workflows.ts     # Workflow definitions (orchestration logic)
│   ├── worker.ts        # Worker process setup
│   └── client.ts        # Start workflows from here
├── package.json
└── tsconfig.json
```

## 5. Run Hello World

Terminal 1 (keep dev server running):
```bash
temporal server start-dev
```

Terminal 2 (start worker):
```bash
npm run start        # or: npx ts-node src/worker.ts
```

Terminal 3 (execute workflow):
```bash
npm run workflow     # or: npx ts-node src/client.ts
```

## 6. Key npm Scripts (generated project)

```json
{
  "start": "ts-node src/worker.ts",
  "start.watch": "nodemon src/worker.ts",
  "workflow": "ts-node src/client.ts",
  "build": "tsc --build",
  "test": "mocha --exit src/mocha/*.test.ts"
}
```

## 7. Core Code Patterns

### Worker (src/worker.ts)
```ts
import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    taskQueue: 'my-queue',
    activities,
  });
  await worker.run();
}

run().catch((err) => { console.error(err); process.exit(1); });
```

### Client (src/client.ts)
```ts
import { Client } from '@temporalio/client';
import { myWorkflow } from './workflows';

async function run() {
  const client = new Client(); // defaults to localhost:7233
  const handle = await client.workflow.start(myWorkflow, {
    workflowId: 'my-workflow-id',
    taskQueue: 'my-queue',
    args: ['arg1'],
  });
  const result = await handle.result();
  console.log(result);
}
```

### Activity definition (src/activities.ts)
```ts
export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}
```

Activities run in standard Node.js. Cannot be in same file as Workflows. Must be separately registered.

### Activity execution from Workflows
```ts
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { greet } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});
```

Never call Activity functions directly — always use `proxyActivities`. Must set `startToCloseTimeout` or `scheduleToCloseTimeout`.

### Dependency injection for Activities
```ts
// activities.ts
export const createActivities = (db: DB) => ({
  async greet(name: string): Promise<string> {
    const dbName = await db.get('name');
    return `Hello, ${dbName}!`;
  },
});

// worker.ts
const worker = await Worker.create({
  activities: createActivities(db),
  // ...
});
```

## 8. Adding AI SDK (for workshop)

```bash
npm install @temporalio/ai-sdk ai zod
```

Worker setup with AI SDK plugin:
```ts
import { Worker } from '@temporalio/worker';
import { AiSDKPlugin } from '@temporalio/ai-sdk';

const worker = await Worker.create({
  plugins: [new AiSDKPlugin()],
  taskQueue: 'my-queue',
  workflowsPath: require.resolve('./workflows'),
  activities,
});
```

## 9. Docker Notes

- Use `node:20-bullseye` (not Alpine — musl incompatible with Temporal's Rust core)
- Set `NODE_OPTIONS=--max-old-space-size=<80% of container memory>`
