# Crash Demo: SAP Dispute Resolution Agent

Demonstrates the crash vulnerability in `BafAgentClient.ts` — the `while(true)` polling loop holds all state in memory. Kill the process mid-poll and everything is lost.

## Prerequisites

- Node.js 22+
- `@sap/cds-dk` installed globally: `npm i -g @sap/cds-dk`

## 1. Start the Mock BAF Server

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

## 2. Start the Agent Connector

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
| `chatId` | Local variable in `invokeAgentSync()` |
| `historyId` | Local variable in `invokeAgentSync()` |
| Poll loop position | `while(true)` iterator in `triggerStatusUpdate()` |
| Task store (all tasks) | In-memory `TaskStore` in the A2A SDK |
| Event bus subscribers | In-memory `ExecutionEventBus` |

**Restart the agent connector** (`npm run watch`). It comes back with a blank slate. The BAF chat still exists server-side, but the connector has no way to find or resume it.

**Verify the blank slate** — the connector logs show only the CDS startup, with zero `[BAFAgentExecutor]` lines. No tasks, no chat IDs, no history. The in-flight task is gone.

The mock BAF server is still running and the chat state is still there — but the agent connector has **zero memory** of the in-flight task. There is no crash recovery path.

## 7. Discussion Points

- The `while(true)` loop in `BafAgentClient.ts:triggerStatusUpdate()` is the core vulnerability
- `sleep(1500)` between polls — if process dies during sleep, no timer persists
- No checkpointing, no WAL, no external state store
- The A2A SDK's `TaskStore` is also in-memory — the task itself vanishes
- **This is what Temporal solves:** the workflow function replaces the `while(true)` loop, timers survive crashes, and the full execution history is persisted in Temporal Server
