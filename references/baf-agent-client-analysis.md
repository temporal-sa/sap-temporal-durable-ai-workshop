# BafAgentClient.ts Analysis

Source: `references/btp-a2a-dispute-resolution/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts`

## What It Does

Polls SAP Business Agent Foundation (BAF) for dispute resolution task state. Architecture: Joule → A2A → CAP Service → `BAFAgentClient` → poll BAF → sleep(1500) → loop.

Two main methods:
1. **`invokeAgentSync()`** — creates a chat, sends a message to BAF agent, returns `chatId` + `historyId`
2. **`triggerStatusUpdate()`** — `while(true)` polling loop that checks chat state every 1.5s

## The Polling Loop (lines 43-136)

```ts
while (true) {
    const chat = await client.get(`.../chats(${chatId})?$select=state`);
    switch (chat.data.state) {
        case "none":     // → publish "unknown"
        case "pending":  // → publish "submitted"
        case "running":  // → fetch trace, publish "working" with agent thoughts
        case "success":  // → fetch answer, publish artifact + "completed", return
        case "error":    // → publish "failed", return
    }
    await sleep(1500);
}
```

## Crash Vulnerability Points

| # | Crash Point | What's Lost |
|---|------------|-------------|
| 1 | During `invokeAgentSync()` after chat created but before return | `chatId`/`historyId` — can't poll, orphaned BAF chat |
| 2 | Mid-loop after GET state but before publish | State read but event never sent, client never learns |
| 3 | Between loop iterations (during sleep) | All accumulated state — loop restarts from scratch or doesn't restart at all |
| 4 | After "success" artifacts published but before `eventBus.finished()` | Task appears incomplete to upstream despite being done |
| 5 | Process crash at any point | `chatId`, `historyId`, loop position — all in-memory, all gone |

Core problem: **state lives entirely in memory** (local variables + loop position). No persistence = no recovery.

## Bug: Double Return (line 128-129)

```ts
case "success":
    // ... publish artifact and final status ...
    return;
    return;  // dead code, likely copy-paste error
```

## Mapping to Temporal

| Current (in-memory) | Temporal Equivalent |
|---------------------|-------------------|
| `invokeAgentSync()` | **Activity** — non-deterministic (HTTP call), auto-retried on failure |
| `while(true)` loop | **Workflow** — durable loop, survives crashes, timer persisted |
| `sleep(1500)` | `workflow.sleep('1.5s')` — durable timer, doesn't hold a process |
| `client.get(state)` | **Activity** (`checkState`) — each poll is a retryable unit |
| `eventBus.publish()` | **Activity** — side effect, should be in Activity |
| `chatId`/`historyId` | **Workflow state** — automatically persisted by Temporal |
| Loop position | **Event History** — Temporal knows exactly where execution stopped |

## Durable Version Sketch

```ts
// workflow.ts
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';

const { invokeBAF, checkState, publishStatus, publishArtifact } =
  proxyActivities<typeof activities>({ startToCloseTimeout: '30s' });

export async function disputeResolutionWorkflow(taskId: string, message: string) {
  const { chatId, historyId } = await invokeBAF(taskId, message);

  while (true) {
    const state = await checkState(chatId);

    switch (state.status) {
      case 'pending':
      case 'running':
        await publishStatus(taskId, state);
        break;
      case 'success':
        await publishArtifact(taskId, state.content);
        await publishStatus(taskId, { status: 'completed' });
        return;
      case 'error':
        await publishStatus(taskId, { status: 'failed' });
        return;
    }

    await sleep('1500ms'); // durable timer — crash-safe
  }
}
```

```ts
// activities.ts
export async function invokeBAF(taskId: string, message: string) {
  // HTTP calls to BAF — retried automatically on transient failure
}

export async function checkState(chatId: string) {
  // GET chat state — single retryable unit
}

export async function publishStatus(taskId: string, status: any) {
  // eventBus.publish — side effect in Activity
}

export async function publishArtifact(taskId: string, content: string) {
  // publish artifact — side effect in Activity
}
```

Key behavioral change: crash mid-loop → Temporal replays from last completed Activity. `chatId`/`historyId` are Workflow state. Sleep is a durable timer.
