# Architecture: Temporal Dispute Resolution (Hour 3)

Architecture reference for the Temporal version of the SAP dispute resolution polling loop. Shows how each piece of the original [`BafAgentClient.ts`](btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts) maps to Temporal constructs.

> **Demo steps:** [demo-durable-dispute-resolution.md](demo-durable-dispute-resolution.md)

## How the Original Maps to Temporal

| Original (`BafAgentClient.ts`) | Temporal Version | File |
|---|---|---|
| `invokeAgentSync()` — create chat + send message | `invokeBAF()` activity — same HTTP calls, auto-retried | `activities.ts` |
| `triggerStatusUpdate()` — `while(true)` polling loop | `disputeResolutionWorkflow()` — durable loop, crash-safe | `workflows.ts` |
| Poll state GET inside while loop | `checkState()` activity — individual HTTP call, retryable | `activities.ts` |
| Trace fetch during `running` state | `getTrace()` activity | `activities.ts` |
| Final answer fetch on `success` | `getResult()` activity | `activities.ts` |
| `sleep(1500)` — JS setTimeout, lost on crash | `workflow.sleep('1500ms')` — durable timer on Temporal server | `workflows.ts` |
| `eventBus.publish()` for status updates | `defineQuery('getStatus')` — queryable from CLI/UI | `workflows.ts` |
| `chatId`/`historyId` in local variables | Stored in Temporal event history — recovered on replay | `workflows.ts` |

## 4 Activities (`activities.ts`)

1. **`invokeBAF(config, taskId, message)`** — POST to create chat + send message, returns `{ chatId, historyId }`
2. **`checkState(config, chatId)`** — GET poll for state, returns state string (`pending`, `running`, `success`, `error`)
3. **`getTrace(config, chatId, historyId)`** — GET agent trace during `running` state, returns concatenated thoughts
4. **`getResult(config, chatId, historyId)`** — GET final answer on `success`, returns resolution text

All activities have `startToCloseTimeout: '30s'` with default retry policy. Token caching is module-level in the activity code (cheap to re-fetch on worker restart).

## Workflow (`workflows.ts`)

```
disputeResolutionWorkflow(disputeMessage)
  → invokeBAF() → { chatId, historyId }
  → loop:
      checkState(chatId)
      switch(state):
        pending/none: update status string
        running: getTrace() → update status with agent thoughts
        success: getResult() → return final answer
        error: throw
      workflow.sleep('1500ms')
      repeat
```

Status exposed via `defineQuery('getStatus')` — queryable with `temporal workflow query --workflow-id <id> --name getStatus` while running or after completion.

## Worker (`worker.ts`) + Client (`client.ts`)

- **Worker** — connects to `localhost:7233`, task queue `dispute-resolution`, registers workflows + activities
- **Client** — starts workflow with dispute message, generates workflow ID via nanoid, prints Temporal UI link, blocks until result

## Mock BAF Server

Same server from the crash demo (`mock-baf/`). Express on port 3001, simulates BAF polling state machine. Per-chat poll counter drives deterministic state transitions: polls 1-4 → `pending`, 5-11 → `running`, 12+ → `success`.

Endpoints:
- `POST /api/v1/Agents(:agentId)/chats` → create chat, return `chatId`
- `POST .../chats(:chatId)/UnifiedAiAgentService.sendMessage` → accept message, return `historyId`
- `GET .../chats(:chatId)?$select=state` → poll state (increments counter)
- `GET .../chats(:chatId)/history(:historyId)/trace` → mock agent reasoning traces
- `GET .../chats(:chatId)/history?$filter=...` → mock final answer
- `POST /oauth/token` → mock OAuth token

**Live/mock switch:** BAF endpoint is configurable. Participants with live BAF access point at real instance; everyone else uses mock server. Same code path either way.

## What Survived the Crash

| Failure | Crash Demo (BafAgentClient) | Temporal Version |
|---|---|---|
| Worker/process crash | All state lost, task gone forever | Workflow replays, state restored from event history |
| Downstream service outage | Error returned, no recovery path | Activity retries automatically until service returns |
| `chatId` / `historyId` | Lost (local variables) | Restored from event history |
| Poll loop position | Lost (while loop iterator) | Replayed from workflow state |
| Sleep timer | Lost (JS setTimeout) | Durable timer on Temporal server |
| Observability | None — printf debugging only | Full event history in Temporal UI |

## What's NOT in Hour 3

> These are intentional omissions — this exercise focuses on durable orchestration of an external service.

- No Vercel AI SDK / LLM calls — this exercise is about durable orchestration of an external service, not AI
- No A2A protocol — we're replacing the connector layer, not the protocol layer
- No Joule / CAP Service — the Temporal Client stands in as the entry point
