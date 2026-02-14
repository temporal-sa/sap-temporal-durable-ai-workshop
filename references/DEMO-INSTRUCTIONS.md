# Crash Demo: SAP Dispute Resolution Agent

Demonstrates the crash vulnerability in [`BafAgentClient.ts`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts) — the `while(true)` polling loop holds all state in memory. Kill the process mid-poll and everything is lost.

## Prerequisites

- Node.js 22+
- `@sap/cds-dk` installed globally: `npm i -g @sap/cds-dk`

## 1. Start the Mock BAF Server ([`server.ts`](mock-baf/server.ts))

```bash
cd references/mock-baf
npm install
npm start
```

You should see:
```
[mock-baf] BAF mock server running on http://localhost:3001
[mock-baf] State machine: poll 1-4 → pending, 5-11 → running, 12+ → success
```

**Quick smoke test:**
```bash
curl -s -X POST http://localhost:3001/oauth/token | jq .
# → { "access_token": "mock-token-...", "expires_in": 3600 }
```

## 2. Start the Agent Connector ([`server.ts`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/server.ts))

In a **second terminal**:

```bash
cd references/btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector
npm install
npm run watch
```

This runs `cds-tsx w --profile hybrid`. Wait for:
```
[cds] - serving ...
[cds] - server listening on { url: 'http://localhost:4004' }
```

> **Troubleshooting:** If `--profile hybrid` tries to resolve CF service bindings, try running `cds watch` directly instead, or set `CDS_ENV=development` before running.

**Verify agent card loads:**
```bash
curl -s http://localhost:4004/.well-known/agent.json | jq .name
```

## 3. Trigger a Dispute

In a **third terminal**, send the A2A `message/send` request:

```bash
curl -s -X POST http://localhost:4004/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-001",
        "role": "user",
        "parts": [{"type": "text", "text": "Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve."}]
      }
    }
  }' | jq .
```

## 4. Watch the Polling

**Mock BAF terminal** shows the state machine progressing:
```
[mock-baf] Chat created | ID: abc-123 | name: dispute-001
[mock-baf] Message sent | Chat: abc-123 | History: def-456
[mock-baf] Chat abc-123... | Poll #1 | State: pending
[mock-baf] Chat abc-123... | Poll #2 | State: pending
...
[mock-baf] Chat abc-123... | Poll #5 | State: running
[mock-baf] Trace requested
[mock-baf] Chat abc-123... | Poll #6 | State: running
...
[mock-baf] Chat abc-123... | Poll #12 | State: success
[mock-baf] Final answer requested
```

**Agent connector terminal** shows the CDS server processing the task.

If you let it complete, the curl response includes the dispute resolution.

## 5. THE CRASH DEMO

Now trigger another dispute (the task ID is auto-generated server-side; we just need a fresh JSON-RPC request):

```bash
curl -s -X POST http://localhost:4004/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-2",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-002",
        "role": "user",
        "parts": [{"type": "text", "text": "Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve."}]
      }
    }
  }' &
```

> **Note:** The `&` backgrounds curl so your terminal stays free to watch the BAF logs.

Watch the mock BAF terminal — after you see **Poll #2 or #3** (state is "pending" or "running"):

### Kill the agent connector: `Ctrl+C` in the agent connector terminal.

That's it. The agent process is dead.

## 6. What Was Lost

Everything that was only in memory:

| Lost State | Where It Lived |
|-----------|---------------|
| `chatId` | Local variable in [`invokeAgentSync()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L20-L36) |
| `historyId` | Local variable in [`invokeAgentSync()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L20-L36) |
| Poll loop position | `while(true)` iterator in [`triggerStatusUpdate()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L38-L138) |
| Task store (all tasks) | In-memory `TaskStore` in the A2A SDK |
| Event bus subscribers | In-memory `ExecutionEventBus` |

**Restart the agent connector** (`npm run watch`). It comes back with a blank slate. The BAF chat still exists server-side, but the connector has no way to find or resume it.

**Verify the blank slate** — the connector logs show only the CDS startup, with zero `[BAFAgentExecutor]` lines. No tasks, no chat IDs, no history. The in-flight task is gone.

The mock BAF server is still running and the chat state is still there — but the agent connector has **zero memory** of the in-flight task. There is no crash recovery path.

## 7. Discussion Points

- The `while(true)` loop in [`BafAgentClient.ts:triggerStatusUpdate()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L43) is the core vulnerability
- [`sleep(1500)`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L135) between polls — if process dies during sleep, no timer persists
- No checkpointing, no WAL, no external state store
- The A2A SDK's `TaskStore` is also in-memory — the task itself vanishes
- **This is what Temporal solves:** the workflow function replaces the `while(true)` loop, timers survive crashes, and the full execution history is persisted in Temporal Server

---

# Durable Version: Temporal Dispute Resolution

Same BAF polling logic, now orchestrated by Temporal. Kill the worker mid-poll, restart it, and the workflow resumes automatically — `chatId`, `historyId`, and loop position restored from event history.

## Prerequisites

- Node.js 22+
- Temporal CLI: `brew install temporal` (or see [docs](https://docs.temporal.io/cli#install))
- Mock BAF server running (from crash demo above)

## How It Maps to the Original Code

The Temporal version replaces the crash-vulnerable code in [`BafAgentClient.ts`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts):

| Original (in-memory) | Temporal Version | File |
|---|---|---|
| [`invokeAgentSync()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L20-L36) — creates chat, sends message | [`invokeBAF()` activity](temporal-dispute-resolution/src/activities.ts) — same HTTP calls, auto-retried | `activities.ts` |
| [`triggerStatusUpdate()`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L38-L138) — `while(true)` polling loop | [`disputeResolutionWorkflow()`](temporal-dispute-resolution/src/workflows.ts) — durable loop, crash-safe | `workflows.ts` |
| [`sleep(1500)`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L135) — JS setTimeout, lost on crash | `workflow.sleep('1500ms')` — durable timer, survives crashes | `workflows.ts` |
| `chatId`/`historyId` in local variables | Stored in Temporal event history — recovered automatically | [`workflows.ts`](temporal-dispute-resolution/src/workflows.ts) |
| `eventBus.publish()` for status updates | `defineQuery('getStatus')` — queryable from UI/CLI | [`workflows.ts`](temporal-dispute-resolution/src/workflows.ts) |

## 1. Start Temporal Dev Server

```bash
temporal server start-dev
```

Wait for:
```
Temporal Server is now running on localhost:7233
Web UI: http://localhost:8233
```

## 2. Start Mock BAF Server ([`server.ts`](mock-baf/server.ts))

Same server used in the crash demo (if still running, skip this step):

```bash
cd references/mock-baf
npm install
npm start
```

## 3. Start the Temporal Worker ([`worker.ts`](temporal-dispute-resolution/src/worker.ts))

In a **new terminal**:

```bash
cd references/temporal-dispute-resolution
npm install
npm start
```

You should see:
```
Worker started — listening on task queue: dispute-resolution
Temporal UI: http://localhost:8233
```

## 4. Run a Dispute ([`client.ts`](temporal-dispute-resolution/src/client.ts))

In another terminal:

```bash
cd references/temporal-dispute-resolution
npx ts-node src/client.ts 'Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve.'
```

The client prints the workflow ID and Temporal UI link, then waits for the result (~18 seconds).

Watch the **worker terminal** — you'll see each poll logged with state transitions:
```
[INFO] Invoking BAF agent { message: 'Ali from XStore...' }
[INFO] BAF chat created { chatId: '...', historyId: '...' }
[INFO] Poll #1 { state: 'pending' }
...
[INFO] Poll #5 { state: 'running' }
[INFO] Agent thinking { trace: 'Analyzing dispute...' }
...
[INFO] Poll #12 { state: 'success' }
[INFO] Dispute resolved { resultLength: 493 }
```

## 5. Query Workflow Status (defined in [`workflows.ts`](temporal-dispute-resolution/src/workflows.ts#L13))

While a workflow is running (or after it completes):

```bash
temporal workflow query --workflow-id <workflow-id> --name getStatus
```

Returns the current status string (e.g., `running (poll #7): Analyzing dispute...`).

## 6. THE RECOVERY DEMO

This is the key teaching moment. Start another dispute:

```bash
cd references/temporal-dispute-resolution
npx ts-node src/client.ts 'Recovery test dispute' &
```

Watch the **worker terminal** — after you see **Poll #3 or #4**:

### Kill the worker hard — open a new terminal and run:

```bash
pkill -9 -f "temporal-dispute-resolution.*worker"
```

> **Why not Ctrl+C?** The Temporal worker does a graceful shutdown — it finishes executing the current workflow task before stopping. With fast 1.5s polls, the workflow completes before the worker shuts down. Use `kill -9` to simulate a real crash (OOM, hardware failure, deployment kill).

The worker is dead. But unlike the crash demo:

```bash
# The workflow is still alive on the Temporal server:
temporal workflow describe --workflow-id <workflow-id>
# → Status: RUNNING (not lost!)
```

### Restart the worker:

```bash
cd references/temporal-dispute-resolution
npm start
```

Watch what happens:
1. The worker replays the event history (no new HTTP calls for already-completed activities)
2. `chatId` and `historyId` are restored from the replay — **not re-fetched**
3. The polling loop continues from where it left off
4. The workflow completes and the client gets the result

**No duplicate chat creation. No lost state. No manual recovery.**

## 7. What Survived the Crash

| State | Crash Demo (BafAgentClient) | Temporal Version |
|---|---|---|
| `chatId` / `historyId` | Lost (local variables) | Restored from event history |
| Poll loop position | Lost (while loop iterator) | Replayed from workflow state |
| Sleep timer | Lost (JS setTimeout) | Durable timer on Temporal server |
| Kill behavior | Process dead, task gone forever | Worker restarts, workflow resumes |
| Observability | None — printf debugging only | Full event history in Temporal UI |
| Status updates | `eventBus.publish()` (in-memory) | `workflow.query('getStatus')` (durable) |

## 8. Explore in Temporal UI

Open http://localhost:8233 and click on the workflow:

- **Event History** — every activity completion, timer, and state transition is recorded
- **Input/Output** — see the dispute message in, resolution result out
- **Workers** — see connected workers and task queue health
- Click on individual events to see activity inputs/outputs (the exact HTTP payloads to mock BAF)
