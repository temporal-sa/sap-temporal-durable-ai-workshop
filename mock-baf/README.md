# Mock BAF Server

Simulates SAP Business Agent Foundation API for the crash demo. No real credentials needed.

## Run

```bash
npm install
npm start
```

Server starts on `http://localhost:3001`.

## State Machine

Each chat progresses through states based on poll count:

| Polls | State |
|-------|-------|
| 1-2 | `pending` |
| 3-5 | `running` |
| 6+ | `success` |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/oauth/token` | Returns mock access token |
| POST | `/api/v1/Agents(:id)/chats` | Creates chat session |
| POST | `.../chats(:id)/UnifiedAiAgentService.sendMessage` | Sends message, returns historyId |
| GET | `.../chats(:id)?$select=state` | Polls chat state |
| GET | `.../history(:id)/trace` | Returns agent thought traces |
| GET | `.../history?$filter=...` | Returns final dispute answer |

## Verify

```bash
curl -s -X POST http://localhost:3001/oauth/token | jq .
curl -s -X POST http://localhost:3001/api/v1/Agents\(mock-agent-001\)/chats \
  -H "Content-Type: application/json" -d '{"name":"test"}' | jq .
```

See [demo-crash-vulnerability.md](../demo-crash-vulnerability.md) for the full end-to-end crash demo.
