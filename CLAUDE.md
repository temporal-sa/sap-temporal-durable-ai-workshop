# SAP x Temporal Workshop

Durable AI Agents for SAP. 4-hour workshop for SAP architects introducing Temporal as durable execution platform for SAP agents.

## Workshop Structure

- **Hour 1**: Why durability matters — problem space, Temporal intro, crash vulnerability in existing SAP Dispute Resolution agent
- **Hour 2**: Hands-on setup — Hello World (TS), SAP Gen AI Hub Vercel AI SDK adapter + LiteLLM, durable agent w/ tools
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

## CRITICAL: Definitive Customer Ask

**`resources/d318488c-cf46-43d1-bf54-0b424c37f02a.pdf`** is THE definitive ask from the customer. All workshop planning must conform to this document. Extracted to **`resources/customer-ask-extracted.md`** for easy reference. If agenda discussions drift, defer to this PDF.

## References

- `references/temporal-ai-sdk-and-sap-adapter.md` — how Temporal's `@temporalio/ai-sdk` and SAP's `@sap/ai-sdk-vercel-adapter` compose together (core pattern for Hours 2-3)
- `references/baf-agent-client-analysis.md` — BafAgentClient.ts crash vulnerability analysis + Temporal mapping + durable version sketch
- `references/training-exercises-overview.md` — available training repos (Python 7-exercise, TS edu-101/102, TS samples) with gap analysis
- `references/btp-a2a-dispute-resolution/` — cloned SAP dispute resolution repo (source of BafAgentClient.ts)
- `references/temporal-training-exercise-python/` — cloned 7-exercise Python training series (basis for TS port)
- `references/samples-typescript/` — cloned Temporal TS samples repo (ai-sdk/ sample is key)
- `references/mock-baf/` — Mock BAF server (Express, port 3001) simulating SAP BAF polling state machine for crash demo without real credentials
- `references/DEMO-INSTRUCTIONS.md` — step-by-step guide: start mock BAF, start agent connector, trigger dispute via curl, kill mid-poll to demo crash vulnerability
- `resources/temporal-ts-local-dev-setup.md` — TS SDK local dev setup guide (CLI, project scaffold, hello world)
- `resources/temporal-workflows-concept.md` — core Workflows concepts (definitions, Activities, determinism, timers, signals)

## Audience

SAP senior developers. They have not used Temporal before. Goal: understand Temporal positioning, make existing use case durable, test/break/recover.
