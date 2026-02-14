# Temporal Workflows — Core Concepts

Source: [docs.temporal.io/workflows](https://docs.temporal.io/workflows)

## What is a Workflow?

A sequence of steps defined in code. Temporal calls this **Workflows-as-Code** — no DSL, no YAML, just functions in your programming language.

Three related terms:
- **Workflow Definition** — the code you write (a function)
- **Workflow Type** — the name/identifier for that definition
- **Workflow Execution** — a running instance of the definition

## Why Workflows?

Temporal Workflows are **resilient**. They can run for years. If the app crashes, Temporal recreates pre-failure state and continues where it left off. This is **Durable Execution**.

How it works: Temporal records each significant step as an **Event** in an append-only **Event History**. On crash, the Workflow replays from this history to restore state — no manual checkpointing needed.

## Workflows vs Activities

| | Workflow | Activity |
|---|---------|----------|
| Purpose | Orchestration logic | Individual units of work |
| Determinism | Must be deterministic | Can be non-deterministic |
| Examples | Loops, conditionals, state mgmt | HTTP calls, DB writes, file I/O |
| On failure | Replayed from Event History | Retried automatically |
| Runs on | Temporal's sandboxed runtime | Regular Node.js |

Rule of thumb: **Workflow = what to do and when. Activity = how to do it.**

## TypeScript Workflow Example

```ts
// workflows.ts
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';

const { greet, sendEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function onboardUser(name: string, email: string): Promise<string> {
  const greeting = await greet(name);       // Activity — retryable
  await sendEmail(email, greeting);          // Activity — retryable
  await sleep('24 hours');                   // Durable timer — survives crashes
  await sendEmail(email, 'How is it going?');
  return `Onboarded ${name}`;
}
```

```ts
// activities.ts
export async function greet(name: string): Promise<string> {
  return `Welcome, ${name}!`;
}

export async function sendEmail(to: string, body: string): Promise<void> {
  // call email API — Temporal retries on transient failure
}
```

## Key Properties

### Deterministic Constraints
Workflow code must produce the same result given the same inputs. This enables replay.

**Don't do in Workflows:**
- `Math.random()`, `Date.now()`, `uuid()`
- Direct HTTP/network calls
- File I/O
- Global mutable state

**Do instead:** put non-deterministic logic in Activities. Use `workflow.sleep()` instead of `setTimeout`.

### Durable Timers
`sleep('30 days')` doesn't hold a process for 30 days. Temporal persists the timer and wakes the Workflow when it fires. Process can crash and restart — timer still fires on schedule.

### Signals (mutate state, fire-and-forget)

External events sent to a running Workflow. Use for human-in-the-loop (approvals, user input).

```ts
import * as wf from '@temporalio/workflow';

export const approve = wf.defineSignal<[{ name: string }]>('approve');

export async function approvalWorkflow(): Promise<string> {
  let approved = false;
  wf.setHandler(approve, () => { approved = true; });
  await wf.condition(() => approved); // blocks until signal received
  return 'Approved!';
}
```

Client side: `await handle.signal(approve, { name: 'me' });`

### Queries (read state, synchronous)

Read-only handlers to inspect Workflow state. Cannot be async, cannot mutate state, cannot execute Activities.

```ts
export const getStatus = wf.defineQuery<string>('getStatus');

// inside workflow:
wf.setHandler(getStatus, () => currentStatus);
```

Client side: `const status = await handle.query(getStatus);`

### condition() with timeout

```ts
// returns true if condition met, false if timed out
const signalReceived = await wf.condition(() => approved, '30 seconds');
```

### Child Workflows
Workflows can start other Workflows. Use for decomposing complex logic or managing independent lifecycle.

### Continue-As-New
When Event History grows large, close Workflow and start fresh with new Run ID and clean history. Pass current state as args.

```ts
if (wf.workflowInfo().continueAsNewSuggested) {
  return await wf.continueAsNew<typeof myWorkflow>(currentState);
}
```

## SAP Workshop Relevance

The `BafAgentClient.ts` polling loop maps directly to a Temporal Workflow:
- `while(true)` → Workflow loop (durable, crash-safe)
- `sleep(1500)` → `workflow.sleep('1.5s')` (durable timer)
- HTTP calls to BAF → Activities (auto-retried)
- `chatId`/`historyId` → Workflow state (persisted in Event History)

See `references/baf-agent-client-analysis.md` for full mapping.
