# Temporal Dispute Resolution

Durable version of the BAF polling loop from `BafAgentClient.ts`. Same HTTP calls to BAF, but orchestrated by Temporal — crash the worker mid-poll, restart, workflow resumes automatically.

## Purpose

Workshop Hour 3 deliverable. Participants compare this against the crash-vulnerable `while(true)` loop in the original agent connector, then run the recovery demo.

## How It Maps to the Original

| File | Maps to | What it does |
|---|---|---|
| `src/activities.ts` | `BafAgentClient.invokeAgentSync()` + polling HTTP calls | 4 activities: `invokeBAF`, `checkState`, `getTrace`, `getResult` |
| `src/workflows.ts` | `BafAgentClient.triggerStatusUpdate()` while-loop | Durable polling loop with `sleep('1500ms')` + `getStatus` query |
| `src/worker.ts` | N/A (new) | Temporal worker on task queue `dispute-resolution` |
| `src/client.ts` | N/A (new) | Starts workflow, prints Temporal UI link, waits for result |

Original source: `../btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts`

## Running

Requires Temporal dev server (`temporal server start-dev`) and mock BAF (`../mock-baf/`).

```bash
npm install
npm start          # start worker
npx ts-node src/client.ts 'dispute message...'  # start workflow
```

Full step-by-step including recovery demo: `../DEMO-INSTRUCTIONS.md` § "Durable Version: Temporal Dispute Resolution"

VS Code Terminal Keeper session: `.vscode/sessions.json` → `temporal-demo`

## Config

Mock BAF defaults hardcoded in `workflows.ts` (`localhost:3001`). For real BAF, swap the `BafConfig` values.

## Key Temporal Concepts Demonstrated

- **Activities** — non-deterministic HTTP calls, auto-retried on failure
- **Workflow state** — `chatId`/`historyId` survive crashes (stored in event history)
- **Durable timers** — `sleep('1500ms')` persists on Temporal server, not in process memory
- **Queries** — `getStatus` query replaces in-memory `eventBus.publish()`
- **Replay** — on worker restart, completed activities are skipped (no duplicate HTTP calls)
