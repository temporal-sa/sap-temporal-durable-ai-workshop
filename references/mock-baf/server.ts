import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory state: chatId -> { historyId, pollCount }
const chats = new Map<string, { historyId: string; pollCount: number }>();

// ── Helpers ──

function extractId(segment: string): string {
  // Extracts ID from OData-style parens: "chats(abc-123)" -> "abc-123"
  const match = segment.match(/\(([^)]+)\)/);
  return match ? match[1] : segment;
}

function getState(pollCount: number): string {
  if (pollCount <= 4) return "pending";
  if (pollCount <= 11) return "running";
  return "success";
}

// ── OAuth token ──

app.post("/oauth/token", (_req, res) => {
  console.log("[mock-baf] Token requested");
  res.json({ access_token: "mock-token-" + Date.now(), expires_in: 3600 });
});

// ── Create chat ──
// POST /api/v1/Agents(:agentId)/chats

app.post("/api/v1/*", (req, res) => {
  const url = req.url;

  // Create chat: /api/v1/Agents(...)/chats
  if (url.match(/\/Agents\([^)]+\)\/chats$/) && !url.includes("sendMessage") && !url.includes("history")) {
    const chatId = crypto.randomUUID();
    chats.set(chatId, { historyId: "", pollCount: 0 });
    console.log(`[mock-baf] Chat created | ID: ${chatId} | name: ${req.body?.name ?? "?"}`);
    res.json({ ID: chatId });
    return;
  }

  // Send message: /api/v1/Agents(...)/chats(...)/UnifiedAiAgentService.sendMessage
  if (url.includes("sendMessage")) {
    const segments = url.split("/");
    let chatId = "";
    for (const seg of segments) {
      if (seg.startsWith("chats(")) {
        chatId = extractId(seg);
        break;
      }
    }
    const historyId = crypto.randomUUID();
    const chat = chats.get(chatId);
    if (chat) {
      chat.historyId = historyId;
    } else {
      chats.set(chatId, { historyId, pollCount: 0 });
    }
    console.log(`[mock-baf] Message sent | Chat: ${chatId} | History: ${historyId}`);
    res.json({ historyId });
    return;
  }

  res.status(404).json({ error: "Unknown POST route" });
});

// ── GET routes: state polling, trace, history ──

app.get("/api/v1/*", (req, res) => {
  const url = req.url;

  // Poll state: /api/v1/Agents(...)/chats(...)?$select=state
  if (url.includes("$select=state")) {
    const segments = url.split("/");
    let chatIdRaw = "";
    for (const seg of segments) {
      if (seg.startsWith("chats(")) {
        chatIdRaw = seg;
        break;
      }
    }
    // Strip query string from the parens segment
    const chatId = extractId(chatIdRaw.split("?")[0]);
    let chat = chats.get(chatId);
    if (!chat) {
      // Auto-vivify: simulates real BAF where chats survive server restarts (backed by DB).
      // Temporal retried the activity after our restart — chat state resumes from poll 1.
      console.log(`[mock-baf] Chat ${chatId.slice(0, 8)}... not found — re-creating (simulating DB-backed persistence)`);
      chat = { historyId: "recovered", pollCount: 0 };
      chats.set(chatId, chat);
    }
    chat.pollCount++;
    const state = getState(chat.pollCount);
    console.log(`[mock-baf] Chat ${chatId.slice(0, 8)}... | Poll #${chat.pollCount} | State: ${state}`);
    res.json({ state });
    return;
  }

  // Trace: /api/v1/Agents(...)/chats(...)/history(...)/trace
  if (url.includes("/trace")) {
    console.log("[mock-baf] Trace requested");
    res.json({
      value: [
        {
          type: "agent",
          data: JSON.stringify({
            thought: "Analyzing dispute for order ORD0006. XStore reports 1000 units ordered but only 900 shipped. Checking shipping records and invoice data..."
          })
        },
        {
          type: "tool",
          data: JSON.stringify({ tool: "lookup_order", result: "ORD0006 found" })
        },
        {
          type: "agent",
          data: JSON.stringify({
            thought: "Confirmed discrepancy: 100 units short. Preparing resolution recommendation."
          })
        }
      ]
    });
    return;
  }

  // History (final answer): /api/v1/Agents(...)/chats(...)/history?$filter=...
  if (url.includes("/history") && url.includes("$filter")) {
    console.log("[mock-baf] Final answer requested");
    res.json({
      value: [
        {
          content: [
            "**Dispute Resolution — Order ORD0006**\n\n",
            "**Customer:** Ali, XStore\n",
            "**Issue:** 1000 units ordered, only 900 shipped.\n\n",
            "**Findings:**\n",
            "- Shipping manifest confirms 900 units dispatched on 2024-12-01.\n",
            "- Warehouse log shows 100 units held due to quality check flag.\n",
            "- Invoice was issued for full 1000 units in error.\n\n",
            "**Resolution:**\n",
            "- Credit note issued for 100 units.\n",
            "- Remaining 100 units cleared QC and scheduled for shipment.\n",
            "- Invoice corrected to reflect actual shipment.\n\n",
            "**Status:** Resolved"
          ].join("")
        }
      ]
    });
    return;
  }

  res.status(404).json({ error: "Unknown GET route" });
});

// ── Start ──

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[mock-baf] BAF mock server running on http://localhost:${PORT}`);
  console.log("[mock-baf] State machine: poll 1-4 → pending, 5-11 → running, 12+ → success");
  console.log("[mock-baf] Waiting for requests...\n");
});
