# SAP x Temporal Workshop — Durable AI Agents for SAP

4-hour workshop for SAP architects introducing Temporal as a durable execution platform for SAP agents. Using the Temporal TypeScript SDK, participants make SAP's [btp-a2a-dispute-resolution](https://github.com/SAP-samples/btp-a2a-dispute-resolution) app crash-proof and build durable AI agents with the [Vercel AI SDK](https://sdk.vercel.ai/) + [Temporal AI SDK integration](https://docs.temporal.io/develop/typescript/ai-agent-frameworks#vercel-ai-sdk).

**Audience:** SAP senior developers, no prior Temporal experience. **Language:** TypeScript.

## Status

| Hour | Status |
|---|---|
| [Hour 1: Why Durability Matters](#hour-1-why-durability-matters) | Crash demo done — slides coming soon |
| [Hour 2: Hands-On — Local Setup + AI SDK](#hour-2-hands-on--local-setup--ai-sdk) | Done — exercises in [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial) |
| [Hour 3: Hands-On — Dispute Resolution w/ Durability](#hour-3-hands-on--dispute-resolution-w-durability) | Done — [Crash Demo (current SAP BafAgentClient)](DEMO-INSTRUCTIONS.md#part-1-crash-demo-hour-1) + [Durable Temporal Version](DEMO-INSTRUCTIONS.md#part-2-durable-version--temporal-hour-3) |
| [Hour 4: Vision and Discussion](#hour-4-vision-and-discussion) | Open discussion — no fixed content yet |

## Key files and repos

- **Demo instructions:** [`DEMO-INSTRUCTIONS.md`](DEMO-INSTRUCTIONS.md) — step-by-step for crash demo (Hour 1) and recovery demo (Hour 3)
- **Original SAP repo:** [`btp-a2a-dispute-resolution/`](https://github.com/steveandroulakis/btp-a2a-dispute-resolution) — cloned from [SAP-samples/btp-a2a-dispute-resolution](https://github.com/SAP-samples/btp-a2a-dispute-resolution). Key file: `srv/BafAgentClient.ts`
- **Mock BAF server:** [`mock-baf/`](mock-baf/) — Express on port 3001, simulates BAF polling state machine
- **Temporal dispute resolution:** [`temporal-dispute-resolution/`](temporal-dispute-resolution/) — durable version of BafAgentClient (Hour 3 deliverable)
- **Hour 2 exercises:** [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial) — git submodule. 3 exercises: Hello World, Haiku Agent, Tools Agent. Starter code + solutions + lesson markdown

## Hour 1: Why Durability Matters

Live crash demo showing the vulnerability in `BafAgentClient.ts`, then Temporal intro and discussion.

> **Run it:** [`DEMO-INSTRUCTIONS.md` — Part 1: Crash Demo](DEMO-INSTRUCTIONS.md#part-1-crash-demo)

### Crash Demo

Uses the mock BAF server + SAP agent connector. Three terminals:

1. **Mock BAF** (`mock-baf/`) — Express server on port 3001, simulates BAF polling state machine (polls 1-4 → pending, 5-11 → running, 12+ → success)
2. **Agent Connector** (`btp-a2a-dispute-resolution/.../agent-builder-a2a-agent-connector/`) — CDS server on port 4004, runs `BafAgentClient.ts`
3. **Client terminal** — curl sends A2A `message/send` request to trigger a dispute

### Demo flow

1. Start mock BAF and agent connector
2. Trigger a dispute via curl — watch the polling loop progress in both terminals
3. Let it complete once (happy path) so participants see the full state machine
4. Trigger a second dispute, background the curl (`&`)
5. **Kill the agent connector** (`Ctrl+C`) after Poll #2-3
6. Show what was lost: `chatId`, `historyId`, loop position, task store, event bus — all in-memory, all gone
7. Restart the agent connector — blank slate, zero recovery, orphaned BAF chat

### Key vulnerability points walked through

- `chatId`/`historyId` in local variables in `invokeAgentSync()` — gone on crash
- `while(true)` loop position in `triggerStatusUpdate()` — gone on crash
- `sleep(1500)` — JS setTimeout, no persistence
- `InMemoryTaskStore` — A2A task state also non-durable
- `ExecutionEventBus` subscribers — in-memory

### Discussion points

- No checkpointing, no WAL, no external state store
- BAF chat still exists server-side but connector can't find or resume it
- **This is what Temporal solves** — workflow replaces the loop, timers survive crashes, full execution history persisted

Full step-by-step: [`DEMO-INSTRUCTIONS.md`](DEMO-INSTRUCTIONS.md) (sections 1-6)

### TODO: Additional content from customer ask (likely slides)

- Problem space scenarios beyond BafAgentClient: deep research agent crash (hours lost), multi-agent orchestration failure (inconsistent state), long-running task timeout (no progress preserved), downstream A2A call failure (context lost)
- "Temporal as Durable Foundation" explainer table: normal async function → record of every step, `await` → resumable checkpoint, crash → auto-restart from last checkpoint, external call fails → retry with backoff
- Vision: cross-cutting durable services — Gen AI Hub (LLM calls auto-durable, token tracking across retries), Observability (OTEL traces per workflow step, Dynatrace/Jaeger/SAP Cloud Logging), HANA Cloud (workflow state persistence)
- Key Insights: Temporal replays deterministic steps from history, skips completed activities, resumes from exact crash point
- Discussion: durability-aware Gen AI Hub — retry on 429/5xx with backoff, don't double-charge retried requests, token usage aggregated across retries, model fallback (e.g. Claude → GPT)

## Hour 2: Hands-On — Local Setup + AI SDK

**Exercises:** [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial) (git submodule)

Three exercises, escalating complexity. Single project, lesson-style markdown guides. Participants bring their own LLM API key (OpenAI, Anthropic, or Google) and use Vercel AI SDK provider adapters directly.

### Exercise 1: Hello World (~25 min)

Pure Temporal basics. No AI. Complete starter code — participants run, modify, then crash + recover.

- **Run:** Start Temporal dev server, worker, client → "Hello, Temporal!"
- **Modify:** Add `sleep('10s')` durable timer + `goodbye` Activity
- **Crash demo:** Make `goodbye` throw → observe retries → kill worker → fix error → restart → Workflow resumes from last checkpoint
- **Learn:** Workflows, Activities, Workers, Clients, durable timers, event history, crash recovery

### Exercise 2: Haiku Agent (~15 min)

Add AI. Fill in TODOs to configure `AiSdkPlugin` and implement `haikuAgent`.

- **Build:** Configure AI Worker with `AiSdkPlugin` + provider, implement `haikuAgent` with `generateText()`
- **Learn:** `AiSdkPlugin` auto-wraps LLM calls as Activities — 2-line change from standard Vercel AI SDK code
- **Observe:** LLM call visible as Activity in Temporal UI with full input/output

### Exercise 3: Tools Agent (~15 min)

LLM + function calling, fully durable. Fill in TODOs for `getWeather` Activity and `toolsAgent` Workflow.

- **Build:** `getWeather` Activity + `toolsAgent` with `tool()`, Zod schema, `stopWhen: stepCountIs(5)`
- **Crash demo:** Kill worker mid-agent-loop → restart → completed LLM/tool calls replayed, agent resumes
- **Learn:** Tool calls as Activities, multi-step agent reasoning, full observability in Temporal UI

## Hour 3: Hands-On — Dispute Resolution w/ Durability

Separate project from Hour 2. The BafAgentClient polling loop re-architected with Temporal. Delivered as a complete working project (`temporal-dispute-resolution/`). Same BAF HTTP calls, now durable.

> **Run it:** [`DEMO-INSTRUCTIONS.md` — Part 2: Durable Version](DEMO-INSTRUCTIONS.md#part-2-durable-version--temporal-dispute-resolution)

### The problem (walkthrough from Hour 1)

Recap `BafAgentClient.ts` crash vulnerability — `chatId`/`historyId` in local vars, `while(true)` loop, `sleep(1500)`, `InMemoryTaskStore`. All gone on crash.

### Mock BAF server

Same server from Hour 1 crash demo (`mock-baf/`). Express on port 3001, simulates BAF polling state machine. Per-chat poll counter drives deterministic state transitions: polls 1-4 → `pending`, 5-11 → `running`, 12+ → `success`.

Endpoints:
- `POST /api/v1/Agents(:agentId)/chats` → create chat, return `chatId`
- `POST .../chats(:chatId)/UnifiedAiAgentService.sendMessage` → accept message, return `historyId`
- `GET .../chats(:chatId)?$select=state` → poll state (increments counter)
- `GET .../chats(:chatId)/history(:historyId)/trace` → mock agent reasoning traces
- `GET .../chats(:chatId)/history?$filter=...` → mock final answer
- `POST /oauth/token` → mock OAuth token

**Live/mock switch:** BAF endpoint is configurable. Participants with live BAF access point at real instance; everyone else uses mock server. Same code path either way.

### How the original maps to Temporal

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

### 4 Activities (`activities.ts`)

1. **`invokeBAF(config, taskId, message)`** — POST to create chat + send message, returns `{ chatId, historyId }`
2. **`checkState(config, chatId)`** — GET poll for state, returns state string (`pending`, `running`, `success`, `error`)
3. **`getTrace(config, chatId, historyId)`** — GET agent trace during `running` state, returns concatenated thoughts
4. **`getResult(config, chatId, historyId)`** — GET final answer on `success`, returns resolution text

All activities have `startToCloseTimeout: '30s'` with default retry policy. Token caching is module-level in the activity code (cheap to re-fetch on worker restart).

### Workflow (`workflows.ts`)

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

### Worker (`worker.ts`) + Client (`client.ts`)

- **Worker** — connects to `localhost:7233`, task queue `dispute-resolution`, registers workflows + activities
- **Client** — starts workflow with dispute message, generates workflow ID via nanoid, prints Temporal UI link, blocks until result

### Exercise steps

1. **Walk through the mapping** — show how each piece of `BafAgentClient.ts` maps to workflows/activities
2. **Start Temporal dev server** — `temporal server start-dev`
3. **Start mock BAF** — `cd mock-baf && npm start`
4. **Start worker** — `cd temporal-dispute-resolution && npm start`
5. **Run a dispute** — `npx ts-node src/client.ts 'Ali from XStore disputes order ORD0006...'` — watch it complete (~18s)
6. **Query status** — `temporal workflow query --workflow-id <id> --name getStatus`
7. **RECOVERY DEMO: Worker crash** — start another dispute, `pkill -9 -f "temporal-dispute-resolution.*worker"` after Poll #3-4, verify workflow still RUNNING on server, restart worker, watch it replay + resume + complete
8. **RECOVERY DEMO: Downstream outage** — start another dispute, kill mock BAF mid-poll, watch activity retries in Temporal UI, restart mock BAF, workflow resumes and completes
9. **Explore Temporal UI** — event history, activity inputs/outputs, timers, crash + recovery visible

### What survived the crash

| Failure | Crash Demo (BafAgentClient) | Temporal Version |
|---|---|---|
| Worker/process crash | All state lost, task gone forever | Workflow replays, state restored from event history |
| Downstream service outage | Error returned, no recovery path | Activity retries automatically until service returns |
| `chatId` / `historyId` | Lost (local variables) | Restored from event history |
| Poll loop position | Lost (while loop iterator) | Replayed from workflow state |
| Sleep timer | Lost (JS setTimeout) | Durable timer on Temporal server |
| Observability | None — printf debugging only | Full event history in Temporal UI |

### What's NOT in Hour 3

- No Vercel AI SDK / LLM calls — this exercise is about durable orchestration of an external service, not AI
- No A2A protocol — we're replacing the connector layer, not the protocol layer
- No Joule / CAP Service — the Temporal Client stands in as the entry point

### Key concept reinforced

Same code structure as BafAgentClient (`while(true)`, poll, sleep, switch on state). But now every step is checkpointed. Crash → automatic recovery. This is the "make an existing SAP use case durable" objective from the PDF.

### Teaching moment

The BAF agent is an opaque box with no real tools — it fakes S/4HANA lookups via prompt. Contrast with Hour 2's agent where every tool call is an individually durable, retryable, observable Activity. Natural bridge to Hour 4's "what if this was built natively with Temporal?" discussion.

Full step-by-step: [`DEMO-INSTRUCTIONS.md`](DEMO-INSTRUCTIONS.md) (sections 6-9 for recovery demos)

## Hour 4: Vision and Discussion

_TODO: define — service integration, agent dev toolkit, durability in Joule core_
