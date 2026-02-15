# Demo: Durable Dispute Resolution — Temporal Recovery in Action

In this demo you'll see the same BAF polling logic from the crash demo, now orchestrated by Temporal. Kill the worker mid-poll, restart it, and the workflow resumes automatically — `chatId`, `historyId`, and loop position restored from event history.

**What you'll see:** The same polling loop, now Temporal-orchestrated — kill the worker, kill the BAF server, and the workflow recovers both times.

**What you'll learn:**
- Workflows replace `while(true)` loops — same logic, crash-recoverable
- Event history persists every step — `chatId`, `historyId`, loop position all survive process death
- Activity retries handle downstream outages automatically
- The Temporal UI gives full observability into execution state

**Prerequisites:**
- Node.js 22+
- Temporal CLI: `brew install temporal` (or see [docs](https://docs.temporal.io/cli#install))
- Mock BAF server running (from crash demo, or start it in Step 2)

> [!TIP]
> Architecture reference: [architecture.md](architecture.md) — mapping tables, activity/workflow breakdown, pseudocode.

---

## Step 1: Start Temporal Dev Server

```bash
temporal server start-dev
```

You should see:
```
Temporal Server is now running on localhost:7233
Web UI: http://localhost:8233
```

Leave this terminal running.

---

## Step 2: Start Mock BAF Server

Same server used in the crash demo (if still running, skip this step).

Start the mock BAF server ([`server.ts`](mock-baf/server.ts)):

```bash
cd mock-baf
npm install
npm start
```

You should see:
```
[mock-baf] BAF mock server running on http://localhost:3001
```

---

## Step 3: Start the Temporal Worker

In a **new terminal**, start the worker ([`worker.ts`](temporal-dispute-resolution/src/worker.ts)):

```bash
cd temporal-dispute-resolution
npm install
npm start
```

You should see:
```
Worker started — listening on task queue: dispute-resolution
Temporal UI: http://localhost:8233
```

---

## Step 4: Run a Dispute

In another terminal, run the client ([`client.ts`](temporal-dispute-resolution/src/client.ts)):

```bash
cd temporal-dispute-resolution
npx ts-node src/client.ts 'Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve.'
```

The client prints the workflow ID and Temporal UI link, then waits for the result (~18 seconds).

Watch the **worker terminal** — you'll see each poll logged with state transitions:
```
[INFO] Invoking BAF agent { message: 'Ali from XStore...' }
[INFO] BAF chat created { chatId: '...', historyId: '...' }
[INFO] Poll #1 { state: 'pending' }
...
[INFO] Poll #5 { state: 'running' }
[INFO] Agent thinking { trace: 'Analyzing dispute...' }
...
[INFO] Poll #12 { state: 'success' }
[INFO] Dispute resolved { resultLength: 493 }
```

<details>
<summary>Presenter note</summary>

Let this first run complete so participants see the happy path with Temporal. Point out the worker logs — same HTTP calls as Hour 1's `BafAgentClient.ts`, but now each step is recorded in Temporal's event history.

</details>

---

## Step 5: Query Workflow Status

While a workflow is running (or after it completes), query the status (defined in [`workflows.ts`](temporal-dispute-resolution/src/workflows.ts#L13)):

```bash
temporal workflow query --workflow-id <workflow-id> --name getStatus
```

Returns the current status string (e.g., `running (poll #7): Analyzing dispute...`).

You can also do this in the Temporal UI under 'Queries'.

---

## Step 6: Recovery Demo — Worker Crash

> [!IMPORTANT]
> This is the key teaching moment. Same failure as Hour 1 — but now with a completely different outcome.

### 6a. Start a new dispute

```bash
cd temporal-dispute-resolution
npx ts-node src/client.ts 'Recovery test dispute' &
```

### 6b. Kill the worker mid-poll

Watch the **worker terminal** — after you see **Poll #3 or #4**, kill the worker:

**Option A — Ctrl+C twice** in the worker terminal. First `Ctrl+C` starts graceful shutdown, second forces immediate exit. Be quick — with fast 1.5s polls the workflow can complete during graceful shutdown.

**Option B — `kill -9`** from a new terminal (more reliable):

```bash
pkill -9 -f "temporal-dispute-resolution.*worker"
```

### 6c. Verify the workflow survived

The worker is dead. But unlike the crash demo:

```bash
# The workflow is still alive on the Temporal server:
temporal workflow describe --workflow-id <workflow-id>
# → Status: RUNNING (not lost!)
```

### 6d. Restart the worker

```bash
cd temporal-dispute-resolution
npm start
```

Watch what happens:
1. The worker replays the event history (no new HTTP calls for already-completed activities)
2. `chatId` and `historyId` are restored from the replay — **not re-fetched**
3. The polling loop continues from where it left off
4. The workflow completes and the client gets the result

**No duplicate chat creation. No lost state. No manual recovery.**

<details>
<summary>Presenter note</summary>

Contrast explicitly with Hour 1: same `Ctrl+C`, same mid-poll kill — but now the workflow is still running on the server, and the worker picks up exactly where it left off. No orphaned BAF chats, no lost state.

</details>

---

## Step 7: Recovery Demo — Downstream Service Outage

Different failure mode: the BAF service itself goes down. In production, this is an SAP service outage — Temporal handles it with automatic activity retries.

### 7a. Start a new dispute

```bash
cd temporal-dispute-resolution
npx ts-node src/client.ts 'Downstream outage test' &
```

### 7b. Kill the mock BAF server

Watch the **worker terminal** — after you see **Poll #3 or #4**:

**`Ctrl+C` in the mock BAF terminal.**

The **worker terminal** now shows activity failures with `ECONNREFUSED` errors — Temporal is automatically retrying the failed activity:
```
AxiosError: connect ECONNREFUSED 127.0.0.1:3001
```

Open the **Temporal UI** (http://localhost:8233) — click into the workflow and watch the pending activity. You'll see retry attempts accumulating in real time.

<details>
<summary>Presenter note</summary>

In the crash demo (Hour 1), when the downstream service died, the agent connector just got an error and the whole task was lost. Here, Temporal keeps retrying — no human intervention needed. The workflow is patiently waiting for BAF to come back.

</details>

### 7c. Restart mock BAF

```bash
cd mock-baf
npm start
```

Watch what happens:
1. The next retry succeeds — mock BAF auto-recovers the chat session
2. Polling resumes: pending → running → success
3. The workflow completes as if nothing happened

**The workflow survived both a worker crash AND a downstream service outage.**

---

## Step 8: Explore in Temporal UI

Open http://localhost:8233 and click on the workflow:

- **Event History** — every activity completion, timer, and state transition is recorded
- **Input/Output** — see the dispute message in, resolution result out
- **Workers** — see connected workers and task queue health
- Click on individual events to see activity inputs/outputs (the exact HTTP payloads to mock BAF)

<details>
<summary>Presenter note</summary>

The BAF agent is an opaque box with no real tools — it fakes S/4HANA lookups via prompt. Contrast with Hour 2's agent where every tool call is an individually durable, retryable, observable Activity. Natural bridge to Hour 4's "what if this was built natively with Temporal?" discussion.

</details>

---

## What you saw

| Concept | What you saw |
|---------|-------------|
| **Workflow replaces loop** | Same polling logic as `BafAgentClient.ts`, now crash-recoverable |
| **Event history** | Every activity completion, timer, and state transition persisted on Temporal Server |
| **Worker crash recovery** | Kill worker mid-poll → restart → workflow replays and resumes from where it left off |
| **No duplicate work** | `chatId`/`historyId` restored from replay — no new HTTP calls for completed activities |
| **Downstream outage recovery** | BAF server dies → Temporal auto-retries → BAF restarts → workflow completes |
| **Full observability** | Temporal UI shows execution state, event history, inputs/outputs, retry attempts |
| **What survived the crash** | `chatId`, `historyId`, loop position, timer state — everything that was lost in Hour 1 |
