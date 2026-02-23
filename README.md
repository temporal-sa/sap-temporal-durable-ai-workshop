# SAP x Temporal Workshop — Durable AI Agents for SAP

4-hour workshop for SAP architects introducing Temporal as a durable execution platform for SAP agents. Using the Temporal TypeScript SDK, participants make SAP's [btp-a2a-dispute-resolution](https://github.com/SAP-samples/btp-a2a-dispute-resolution) app crash-proof and build durable AI agents with the [Vercel AI SDK](https://sdk.vercel.ai/) + [Temporal AI SDK integration](https://docs.temporal.io/develop/typescript/ai-agent-frameworks#vercel-ai-sdk).

**Audience:** SAP senior developers, no prior Temporal experience. **Language:** TypeScript.

## Setup

```bash
git clone --recurse-submodules https://github.com/temporal-sa/sap-temporal-durable-ai-workshop.git
```

> **Participants: complete [`PREFLIGHT.md`](PREFLIGHT.md) before the workshop.** Verifies Node version, npm install, TypeScript compilation, and a Hello World workflow end-to-end (~15 min). Catches dependency and bundling issues before they stall you on the day.

## Status

| Hour | Status |
|---|---|
| [Hour 1: Why Durability Matters](#hour-1-why-durability-matters) | Crash demo done — slides coming soon ([TODO.md](TODO.md)) |
| [Hour 2: Hands-On — Local Setup + AI SDK](#hour-2-hands-on--local-setup--ai-sdk) | Done — exercises in [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial) |
| [Hour 3: Hands-On — Dispute Resolution w/ Durability](#hour-3-hands-on--dispute-resolution-w-durability) | Done — [Crash Demo](demo-crash-vulnerability.md) + [Durable Version](demo-durable-dispute-resolution.md) |
| [Hour 4: Vision and Discussion](#hour-4-vision-and-discussion) | Open discussion — no fixed content yet |

## Key files and repos

- **Hour 1 demo:** [`demo-crash-vulnerability.md`](demo-crash-vulnerability.md) — crash demo step-by-step
- **Hour 3 demo:** [`demo-durable-dispute-resolution.md`](demo-durable-dispute-resolution.md) — Temporal recovery demo step-by-step
- **Hour 3 architecture:** [`architecture.md`](architecture.md) — mapping tables, activity/workflow breakdown, pseudocode
- **Original SAP repo:** [`btp-a2a-dispute-resolution/`](https://github.com/temporal-sa/btp-a2a-dispute-resolution) — cloned from [SAP-samples/btp-a2a-dispute-resolution](https://github.com/SAP-samples/btp-a2a-dispute-resolution). Key file: `srv/BafAgentClient.ts`
- **Mock BAF server:** [`mock-baf/`](mock-baf/) — Express on port 3001, simulates BAF polling state machine
- **Temporal dispute resolution:** [`temporal-dispute-resolution/`](temporal-dispute-resolution/) — durable version of BafAgentClient (Hour 3 deliverable)
- **Hour 2 exercises:** [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial) — git submodule. 3 exercises: Hello World, Haiku Agent, Tools Agent. Starter code + solutions + lesson markdown

## Hour 1: Why Durability Matters

Live crash demo showing the vulnerability in `BafAgentClient.ts`, then Temporal intro and discussion.

> **Demo:** [demo-crash-vulnerability.md](demo-crash-vulnerability.md)

### Crash Demo

- **Show:** Mock BAF + agent connector running a dispute end-to-end (happy path)
- **Break:** Kill agent connector mid-poll → all in-memory state lost
- **Discuss:** No checkpointing, no recovery path — this is what Temporal solves

### What participants learn

- Why in-memory state (`chatId`, loop position, sleep timers) is fragile
- What "durable execution" means in practice
- How Temporal's event history replaces in-memory state

> Outstanding slides topics: [TODO.md](TODO.md)

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

Same BAF polling logic from Hour 1, now orchestrated by Temporal. Kill the worker, restart, workflow resumes. Delivered as complete working project (`temporal-dispute-resolution/`).

> **Demo:** [demo-durable-dispute-resolution.md](demo-durable-dispute-resolution.md) | **Architecture:** [architecture.md](architecture.md)

### Walkthrough

- **Map:** Show how each piece of `BafAgentClient.ts` maps to Temporal workflows/activities
- **Run:** Start Temporal + mock BAF + worker → run a dispute end-to-end (~18s)
- **Query:** Check workflow status via CLI while running

### Recovery Demos

- **Worker crash:** Kill worker mid-poll → workflow still RUNNING on server → restart → replays + resumes
- **Downstream outage:** Kill mock BAF → activity retries → restart BAF → workflow completes

### What participants learn

- Workflows replace `while(true)` loops, Activities replace HTTP calls
- `chatId`/`historyId` restored from event history, not re-fetched
- Temporal UI: full observability of every step, retry, timer

## Hour 4: Vision and Discussion

_TODO: define — service integration, agent dev toolkit, durability in Joule core_

Suggestions - pluggable integration with TEmporal frameworks.  (OpenAI integration or pydantic AI done by Pydantic...)
DSL - serverless if they want to avoid dev requirement. (ziglfow links)
Nexus - corss domain and scale.
MCP access to drive existing workflows.
When not to use temporal?  (workflow decision tree....)
Replay slide....




