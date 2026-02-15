# TODO: Additional Workshop Content

Outstanding items from customer ask — likely slides or discussion material.

## Problem Space Scenarios (beyond BafAgentClient)

- Deep research agent crash (hours lost)
- Multi-agent orchestration failure (inconsistent state)
- Long-running task timeout (no progress preserved)
- Downstream A2A call failure (context lost)

## "Temporal as Durable Foundation" Explainer

| Normal Code | With Temporal |
|---|---|
| `async function` | Record of every step |
| `await` | Resumable checkpoint |
| Crash | Auto-restart from last checkpoint |
| External call fails | Retry with backoff |

## Vision: Cross-Cutting Durable Services

- **Gen AI Hub** — LLM calls auto-durable, token tracking across retries
- **Observability** — OTEL traces per workflow step, Dynatrace/Jaeger/SAP Cloud Logging
- **HANA Cloud** — workflow state persistence

## Key Insights

- Temporal replays deterministic steps from history, skips completed activities, resumes from exact crash point

## Discussion: Durability-Aware Gen AI Hub

- Retry on 429/5xx with backoff
- Don't double-charge retried requests
- Token usage aggregated across retries
- Model fallback (e.g. Claude → GPT)
