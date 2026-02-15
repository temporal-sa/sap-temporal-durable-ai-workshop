# Temporal Training Exercises Overview

## Available Training Repos

### 1. Python 7-Exercise Series (cloned)

**Repo:** `references/temporal-training-exercise-python/`
**Source:** `github.com/temporal-sa/temporal-training-exercise-python`

| Exercise | Duration | Topic |
|----------|----------|-------|
| 1 | 30 min | Hello Temporal — basic workflow + activity |
| 2 | 45 min | Money Transfer with Signals — human-in-the-loop |
| 3 | 30 min | Money Transfer with Queries — state monitoring |
| 4 | 15 min | Search Attributes — workflow discoverability |
| 5 | 30 min | User Metadata & Activity Summaries — observability |
| 6 | 45 min | Unit Testing — test workflows, activities, signals, queries |
| 7 | 45 min | Manual Activity Retry — signal-based error correction |

**Total:** ~4 hours. Progressive difficulty. Each exercise has starter code + solution.

Structure: `exercise{N}/` (starter) + `solution{N}/` (complete). Pattern: `uv run exercise{N}/start_worker.py` + `uv run exercise{N}/start_workflow.py`.

**No TypeScript equivalent of this 7-exercise series exists.** This is the basis for porting to TS for the SAP workshop.

### 2. TypeScript edu-101 (referenced, not cloned)

**Repo:** `github.com/temporalio/edu-101-typescript-code`
**Content:** `github.com/temporalio/edu-101-typescript-content`
**Duration:** ~2 hours

Covers: basic Workflows, Activities, Workers, Temporal CLI, Web UI, failure recovery, event history. Uses IP geolocation use case. Includes polyglot exercise (Java interop).

### 3. TypeScript edu-102 (referenced, not cloned)

**Repo:** `github.com/temporalio/edu-102-typescript-code`
**Content:** `github.com/temporalio/edu-102-typescript-content`
**Duration:** ~4 hours

Covers: testing, debugging, deploying. Common developer problems + solutions.

### 4. TypeScript Samples (cloned)

**Repo:** `references/samples-typescript/`
**Source:** `github.com/temporalio/samples-typescript`

Key sample for workshop: `ai-sdk/` — demonstrates `@temporalio/ai-sdk` with Vercel AI SDK. Contains:
- `workflows.ts` — `haikuAgent`, `toolsAgent`, `middlewareAgent`, `mcpAgent` examples
- `activities.ts` — simple tool implementation (getWeather)
- `worker.ts`, `client.ts` — standard Temporal setup

Other potentially useful samples: `hello-world/`, `signals-queries/`, `timer/`, `saga/`.

## Gap Analysis

| Need | Available? |
|------|-----------|
| Progressive TS exercises (hello → signals → queries → testing) | No — Python only. Must port. |
| AI SDK + Temporal TS sample | Yes — `samples-typescript/ai-sdk/` |
| SAP adapter + Temporal integration | Documented in `references/temporal-ai-sdk-and-sap-adapter.md` |
| Dispute resolution durable version | Must build — see `references/baf-agent-client-analysis.md` |
