# SAP x Temporal Workshop

Durable AI Agents for SAP. 4-hour workshop for SAP architects introducing Temporal as durable execution platform for SAP agents.

## Workshop Structure

- **Hour 1**: Why durability matters — problem space, Temporal intro, crash vulnerability in existing SAP Dispute Resolution agent
- **Hour 2**: Hands-on setup — Hello World (TS), Vercel AI SDK + Temporal `@temporalio/ai-sdk`, durable agent w/ tools. **Exercises: [`intro-temporal-vercel-ai-tutorial/`](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial)** (git submodule)
- **Hour 3**: Hands-on — make the Dispute Resolution polling loop durable with Temporal (workflows, activities, worker, client, failure recovery)
- **Hour 4**: Vision/discussion — service integration, agent dev toolkit, durability in Joule core

## Key Context

- Language: **TypeScript**
- Existing codebase: `https://github.com/SAP-samples/btp-a2a-dispute-resolution`
- Key file: `BafAgentClient.ts` — `while(true)` polling loop holding state in memory (crash = lost context)
- Architecture flow: Joule → A2A → CAP Service → BafAgentClient → poll BAF → sleep(1500) → loop
- Durable version: Joule → A2A → CAP Service → Temporal Client → Workflow → invokeBAF() → checkState() → sleep() → loop
- SAP services: Generative AI Hub, HANA Cloud, Business Agent Foundation (BAF), Joule
- Integration: `@sap/ai-sdk-vercel-adapter` with Vercel AI SDK `generateText()`

## Workshop Exercises (Definitive)

**`README.md`** is the definitive per-hour breakdown of what's been built and what's left to do. Check this first for current state of each hour.

## References

- `btp-a2a-dispute-resolution/` — cloned SAP dispute resolution repo. Used in Hour 1 crash demo: run agent connector + mock BAF, trigger dispute, kill mid-poll → all state lost (`chatId`, `historyId`, loop position). Key file: `srv/BafAgentClient.ts` (`while(true)` polling loop, no persistence)
- `mock-baf/` — Mock BAF server (Express, port 3001) simulating SAP BAF polling state machine for crash demo without real credentials
- `temporal-dispute-resolution/` — Temporal durable version of BafAgentClient polling loop (Hour 3 deliverable). Same HTTP calls, crash-recoverable. Uses mock BAF.
- `DEMO-INSTRUCTIONS.md` — step-by-step guide: crash demo (mock BAF + agent connector + kill) AND durable Temporal version (Temporal server + mock BAF + worker + client + recovery demo)
- `intro-temporal-vercel-ai-tutorial/` — **Hour 2 exercises** (git submodule → [steveandroulakis/intro-temporal-vercel-ai-tutorial](https://github.com/steveandroulakis/intro-temporal-vercel-ai-tutorial)). 3 exercises: Hello World, Haiku Agent, Tools Agent. Starter code with TODOs + solutions + lesson markdown

## Audience

SAP senior developers. They have not used Temporal before. Goal: understand Temporal positioning, make existing use case durable, test/break/recover.
