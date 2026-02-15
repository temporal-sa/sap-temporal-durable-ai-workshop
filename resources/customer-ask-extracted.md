# SAP x Temporal Workshop — Customer Ask (Definitive)

Source: `d318488c-cf46-43d1-bf54-0b424c37f02a.pdf`
Classification: INTERNAL — SAP and External Parties under NDA Only
Date: 2026-02-11

## Objectives

1. Build awareness of Temporal and how to use it in SAP's Office of the CTO teams.
2. Agents and applications get durability and cross-cutting services automatically, regardless of agent framework used.
3. Make an existing SAP use case durable. Test it, break it, see it recover.

## Hour 1: Why Durability Matters

Introduce Temporal + example scenarios where lack of durability is a problem.

### Problem Space

- Deep research agent crashes → hours of work lost, restart from scratch
- Multi-agent orchestration failure → inconsistent state, manual cleanup
- Long-running task timeout → no progress preserved, wasted compute
- Downstream A2A call fails → context lost, process must restart

### Demo: BafAgentClient.ts

- Source: https://github.com/SAP-samples/btp-a2a-dispute-resolution/blob/main/agents/sap-agent-builder-a2a/agent-builder-a2a-agent-connector/srv/BafAgentClient.ts#L55
- `while(true)` polling loop holds all state in memory
- Crash = user must re-explain problem from scratch
- Demo with local express app or deployed agent

### Temporal as Durable Foundation

| What you write | What Temporal does |
|---|---|
| Normal async function | Record of every step |
| `await` a function call | Resumable checkpoint |
| Process crashes | Automatically restarts from last checkpoint |
| External call fails | Retries with exponential backoff |

### Vision: Cross-cutting durable services

| Service | Goal |
|---|---|
| SAP Generative AI Hub | LLM calls automatically durable; token counts tracked across retries |
| Observability | OTEL traces for every workflow step; failures surfaced in central trace (Dynatrace, Jaeger, SAP Cloud Logging) |
| SAP HANA Cloud | Workflow state persistence |

### Key Insights

1. Temporal replays deterministic steps from history
2. Skips already-completed activities
3. Resumes from exact crash point

### Discussion: Durability-aware Gen AI Hub

1. Retry on 429/5xx with exponential backoff
2. Don't double-charge for retried requests
3. Token usage aggregated across retries
4. Model fallback (e.g., Claude to GPT if one fails)

## Hour 2: Hands-On — Local (or Server, or Cloud) Setup

1. **Hello World** exercise with Temporal (TS equivalent)
2. **Temporal plugins** — SAP Gen AI Hub Vercel AI SDK Adapter + LiteLLM

Key Code Pattern (TypeScript):
```typescript
import { createSAPAI } from '@sap/ai-sdk-vercel-adapter';
import { generateText } from 'ai';

const sapai = createSAPAI();

const result = await generateText({
  model: sapai.languageModel('anthropic--claude-4.5-sonnet'),
  prompt: 'Analyze this invoice dispute...',
});

console.log(result.text);
```

3. **Durable Agent with Tools** sample (TS equivalent)

## Hour 3: Hands-On — Dispute Resolution w/ Durability

### Problem

Current architecture: Joule → A2A → CAP Service → BafAgentClient → while(true) → poll BAF → sleep(1500) → loop

The polling loop holds all state in memory. A crash loses everything.

### Solution

Replace with: Joule → A2A → CAP Service → start workflow → Temporal Client → Workflow → invokeBAF() → checkState() → sleep() → loop

Each step is recorded, enabling resume from last checkpoint.

### Activities (hands-on steps)

1. Create a TS project and add Temporal and SAP AI SDK Vercel Adapter
2. Define Activities
3. Define Workflows
4. Create Worker
5. Create Client
6. Test Failure Recovery
7. Watch the Magic

## Hour 4: Vision and Discussion

1. **Service integration** → How can we provide more durability via backing services out of the box?
2. **Toolkit for agent development** → Temporal baked in and more or less transparent to developer
3. **Durability in Joule core?**
