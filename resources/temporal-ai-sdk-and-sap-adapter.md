# Temporal AI SDK + SAP Adapter Integration

## Two Composable Layers

| Layer | Package | Role |
|-------|---------|------|
| Model provider | `@sap/ai-sdk-vercel-adapter` | Routes Vercel AI SDK calls through SAP Generative AI Hub |
| Durability | `@temporalio/ai-sdk` | Wraps Vercel AI SDK calls as Temporal Activities automatically |

## How They Compose

SAP's adapter plugs into Temporal's `AiSDKPlugin` as the `modelProvider`:

```ts
import { createSAPAI } from '@sap/ai-sdk-vercel-adapter';
import { AiSDKPlugin } from '@temporalio/ai-sdk';

const worker = await Worker.create({
  plugins: [
    new AiSDKPlugin({
      modelProvider: createSAPAI(),  // SAP Gen AI Hub as provider
    }),
  ],
  connection,
  namespace: 'default',
  taskQueue: 'dispute-resolution',
  workflowsPath: require.resolve('./workflows'),
  activities,
});
```

In the workflow, use `temporalProvider.languageModel()` — calls route through SAP Gen AI Hub while Temporal handles replay/retry/checkpointing:

```ts
import { generateText } from 'ai';
import { temporalProvider } from '@temporalio/ai-sdk';

export async function disputeAgent(prompt: string): Promise<string> {
  const result = await generateText({
    model: temporalProvider.languageModel('anthropic--claude-4.5-sonnet'),
    prompt,
  });
  return result.text;
}
```

## Key Behavior

- `generateText()` calls are automatically wrapped as Activities (no manual Activity definition needed for LLM calls)
- Crash mid-LLM-call → Temporal retries from last checkpoint, doesn't re-run completed calls
- Tools provided via Vercel AI SDK `tools` option execute in workflow context; non-deterministic tool logic must use `proxyActivities`
- MCP server integration also available via `TemporalMCPClient`

## Workshop Context

The PDF (page 5) shows SAP's adapter standalone without Temporal. The hands-on exercises layer Temporal's plugin on top to make those calls durable. This is the core pattern for Hour 2 and Hour 3.

## Source

Full Temporal AI SDK docs: `AI SDK by Vercel integration.md`
