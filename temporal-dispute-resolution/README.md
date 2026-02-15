# Temporal Dispute Resolution

Durable version of the SAP BAF dispute resolution polling loop, orchestrated by [Temporal](https://temporal.io). Replaces the crash-vulnerable `while(true)` loop in [`BafAgentClient.ts`](../btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts) with a Temporal Workflow that survives worker crashes.

## What This Does

1. Creates a BAF chat and sends a dispute message ([`invokeBAF`](src/activities.ts))
2. Polls BAF for state transitions: pending → running → success ([`checkState`](src/activities.ts), [`getTrace`](src/activities.ts), [`getResult`](src/activities.ts))
3. Returns the dispute resolution result

Every step is checkpointed by Temporal. Kill the worker mid-poll, restart it, and the workflow resumes — `chatId`, `historyId`, and loop position restored from event history.

## Prerequisites

- Node.js 22+
- [Temporal CLI](https://docs.temporal.io/cli#install): `brew install temporal`
- [Mock BAF server](../mock-baf/) running on port 3001

## Quick Start

**Terminal 1** — Temporal dev server:
```bash
temporal server start-dev
```

**Terminal 2** — Mock BAF server:
```bash
cd ../mock-baf
npm install && npm start
```

**Terminal 3** — Temporal worker:
```bash
npm install
npm start
```

**Terminal 4** — Run a dispute:
```bash
npx ts-node src/client.ts 'Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve.'
```

> **VS Code users:** Open the Terminal Keeper `temporal-demo` session (`.vscode/sessions.json`) to get all four terminals pre-configured.

## Recovery Demo

The key teaching moment — proving durability:

1. Start a dispute (Terminal 4)
2. Watch the worker log polls: `Poll #1 { state: 'pending' }` ...
3. After Poll #3-4, kill the worker hard: `pkill -9 -f "temporal-dispute-resolution.*worker"`
4. Verify workflow is still running: `temporal workflow describe --workflow-id <id>`
5. Restart the worker: `npm start`
6. Watch the workflow resume and complete — no duplicate chat creation, no lost state

Full instructions: [`demo-durable-dispute-resolution.md`](../demo-durable-dispute-resolution.md)

## Project Structure

```
src/
  activities.ts   — 4 activities mapping to BafAgentClient.ts HTTP calls
  workflows.ts    — durable polling loop + getStatus query handler
  worker.ts       — Temporal worker (task queue: dispute-resolution)
  client.ts       — starts workflow, prints Temporal UI link, waits for result
```

## How It Maps to the Original

| Original ([`BafAgentClient.ts`](../btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts)) | Temporal Version |
|---|---|
| `invokeAgentSync()` — local variables `chatId`/`historyId` | [`invokeBAF()`](src/activities.ts) — stored in Temporal event history |
| `triggerStatusUpdate()` — `while(true)` polling loop | [`disputeResolutionWorkflow()`](src/workflows.ts) — durable loop |
| `sleep(1500)` — JS setTimeout | `workflow.sleep('1500ms')` — durable timer |
| `eventBus.publish()` — in-memory events | `defineQuery('getStatus')` — queryable from UI/CLI |

## Querying Status

While a workflow is running (or after it completes):

```bash
temporal workflow query --workflow-id <workflow-id> --name getStatus
```
