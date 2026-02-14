# Workshop Exercises — What We're Building

Definitive per-hour breakdown of hands-on exercises for the SAP x Temporal workshop.

## Hour 1: Why Durability Matters

_TODO: define — demo of BafAgentClient crash vulnerability, Temporal intro, discussion_

## Hour 2: Hands-On — Local Setup + AI SDK

Three exercises, escalating complexity:

### Exercise 2.1: Hello World

Pure Temporal basics. No AI. Teaches the mechanics.

- **Build:** Workflow, Activity, Worker, Client (TypeScript)
- **Run:** Start Temporal dev server, run worker, execute workflow via client
- **Learn:** What a Workflow is, what an Activity is, how they connect, Temporal UI
- **Source basis:** `samples-typescript/hello-world/` or TS equivalent of Python exercise 1

### Exercise 2.2: Haiku Agent (Durable LLM Call)

Add AI. Swap the Hello World activity for a `generateText()` call.

- **Build:** Workflow that calls `generateText()` via `@temporalio/ai-sdk` plugin
- **Model provider:** LiteLLM (stands in for `@sap/ai-sdk-vercel-adapter` — no SAP credentials needed)
- **Learn:** `AiSdkPlugin` auto-wraps LLM calls as Activities; crash mid-LLM-call → Temporal retries
- **Source basis:** `samples-typescript/ai-sdk/` — `haikuAgent` workflow

### Exercise 2.3: Durable Agent with Tools

LLM + function calling, fully durable.

- **Build:** Workflow with `generateText()` + `tools` (e.g. `getWeather` with Zod schema)
- **How it works:** LLM decides when to call tools → tool executions are Temporal Activities → retryable, observable, crash-safe
- **Agent loop:** LLM calls tool → gets result → reasons → maybe calls another → responds. Capped with `stopWhen: stepCountIs(5)`
- **Learn:** Tool calls as Activities, multi-step agent reasoning, observability in Temporal UI
- **Source basis:** `samples-typescript/ai-sdk/` — `toolsAgent` workflow

### Hour 2 model provider note

The PDF shows the SAP adapter pattern:
```ts
import { createSAPAI } from '@sap/ai-sdk-vercel-adapter';
const sapai = createSAPAI();
// model: sapai.languageModel('anthropic--claude-4.5-sonnet')
```
For the workshop, LiteLLM replaces this since participants may not have SAP Gen AI Hub credentials. Same Vercel AI SDK interface, different provider. Swap is trivial.

## Hour 3: Hands-On — Dispute Resolution w/ Durability

Separate project from Hour 2. A modified version of the BafAgentClient codebase, re-architected with Temporal. Delivered fully working (or near-complete with minor participant modifications — TBD). The flex: same project, same behavior, now durable.

### The problem (walkthrough)

Show participants BafAgentClient.ts. Walk through crash vulnerability points:
- `chatId`/`historyId` in local variables — gone on crash
- `while(true)` loop position — gone on crash
- `sleep(1500)` holds a process — crash during sleep loses everything
- `InMemoryTaskStore` — A2A task state also non-durable

### Mock BAF server

Simple Express app that simulates the BAF state machine. Needed because participants won't have live BAF access. Trivially simple — the real BAF agent has `"tools": []` and just roleplays S/4HANA lookups via LLM prompt instructions. Mock is just a timer-based state machine (~30 lines): a few polls in `pending`, a few in `running`, then `success` with canned dispute resolution text.

- `POST /api/v1/Agents/:agentId/chats` → create chat, return `chatId`
- `POST .../chats/:chatId/sendMessage` → accept message, return `historyId`
- `GET .../chats/:chatId?$select=state` → walk through `pending → running → success` over ~5 polls
- `GET .../chats/:chatId/history/:historyId/trace` → return mock agent reasoning
- `GET .../history?$filter=...` → return mock final answer

**Live/mock switch:** Design the project so BAF endpoint is configurable (env var or config). Participants with live BAF access point at real instance; everyone else uses mock server. Same code path either way.

### Exercise steps

1. **Show the original** — walk through BafAgentClient.ts, identify crash points
2. **Build Activities** — `invokeBAF()` (HTTP POST to create chat + send message), `checkState()` (HTTP GET poll), `publishStatus()` (side effect / event bus)
3. **Build Workflow** — durable `while(true)` loop: `invokeBAF → checkState → switch(state) → publishStatus → workflow.sleep('1.5s') → loop`
4. **Build Worker + Client** — wire it up, start the workflow
5. **Kill the worker mid-loop** — restart it, watch Temporal resume from exact crash point. `chatId`/`historyId` preserved as workflow state. Sleep resumes where it left off.
6. **Watch the Magic** — Temporal UI shows full history: every poll recorded, every state transition visible, crash + recovery clearly shown

### What's NOT in Hour 3

- No Vercel AI SDK / LLM calls — this exercise is about durable orchestration of an external service, not AI
- No A2A protocol — we're replacing the connector layer, not the protocol layer
- No Joule / CAP Service — the Temporal Client stands in as the entry point

### Key concept reinforced

Same code structure as BafAgentClient (`while(true)`, poll, sleep, switch on state). But now every step is checkpointed. Crash → automatic recovery. This is the "make an existing SAP use case durable" objective from the PDF.

### Teaching moment

The BAF agent is an opaque box with no real tools — it fakes S/4HANA lookups via prompt. Contrast with Hour 2's agent where every tool call is an individually durable, retryable, observable Activity. Natural bridge to Hour 4's "what if this was built natively with Temporal?" discussion.

## Hour 4: Vision and Discussion

_TODO: define — service integration, agent dev toolkit, durability in Joule core_
