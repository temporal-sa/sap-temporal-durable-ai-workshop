import axios, { AxiosInstance } from 'axios';

// ── Config ──
// Passed from workflow to activities as explicit args (visible in Temporal UI event history).
export interface BafConfig {
  bafUrl: string;
  agentId: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

// ── Token caching ──
// Module-level variable in worker process. On worker crash, token re-fetched cheaply.
// Mirrors baf/AgentClient.ts TokenFetching class.
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(config: BafConfig): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const resp = await axios.post(config.tokenUrl, 'grant_type=client_credentials', {
    auth: { username: config.clientId, password: config.clientSecret },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  cachedToken = resp.data.access_token;
  // Expire 60s early to avoid edge-case failures
  tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
  return cachedToken!;
}

function createClient(config: BafConfig, token: string): AxiosInstance {
  return axios.create({
    baseURL: config.bafUrl,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Activities ──
// Each maps directly to a BafAgentClient.ts method — see references/baf-agent-client-analysis.md

/**
 * Create a BAF chat and send the dispute message.
 * Maps to BafAgentClient.invokeAgentSync() (lines 20-36)
 */
export async function invokeBAF(
  config: BafConfig,
  taskId: string,
  message: string
): Promise<{ chatId: string; historyId: string }> {
  const token = await getToken(config);
  const client = createClient(config, token);

  // POST /api/v1/Agents({agentId})/chats — create chat
  const createChat = await client.post(`/api/v1/Agents(${config.agentId})/chats`, {
    name: taskId,
  });
  const chatId: string = createChat.data.ID;

  // POST .../sendMessage — start the agent
  const sendMsg = await client.post(
    `/api/v1/Agents(${config.agentId})/chats(${chatId})/UnifiedAiAgentService.sendMessage`,
    { msg: message, async: true }
  );
  const historyId: string = sendMsg.data.historyId;

  return { chatId, historyId };
}

/**
 * Poll current chat state.
 * Maps to GET state in BafAgentClient.triggerStatusUpdate() (lines 45-47)
 */
export async function checkState(config: BafConfig, chatId: string): Promise<string> {
  const token = await getToken(config);
  const client = createClient(config, token);

  const resp = await client.get(
    `/api/v1/Agents(${config.agentId})/chats(${chatId})?$select=state`
  );
  return resp.data.state;
}

/**
 * Get agent trace (thoughts) while running.
 * Maps to GET trace in BafAgentClient.triggerStatusUpdate() (lines 56-62)
 */
export async function getTrace(
  config: BafConfig,
  chatId: string,
  historyId: string
): Promise<string> {
  const token = await getToken(config);
  const client = createClient(config, token);

  const resp = await client.get(
    `/api/v1/Agents(${config.agentId})/chats(${chatId})/history(${historyId})/trace`
  );
  const agentTraces = resp.data.value
    ?.filter((v: any) => v.type === 'agent')
    .map((v: any) => JSON.parse(v.data).thought)
    .join(' ');
  return agentTraces || 'No thoughts yet';
}

/**
 * Get final result on success.
 * Maps to GET history in BafAgentClient.triggerStatusUpdate() (lines 84-91)
 */
export async function getResult(
  config: BafConfig,
  chatId: string,
  historyId: string
): Promise<string> {
  const token = await getToken(config);
  const client = createClient(config, token);

  const resp = await client.get(
    `/api/v1/Agents(${config.agentId})/chats(${chatId})/history?$filter=previous/ID eq ${historyId}`
  );
  const content = resp.data.value?.pop()?.content ?? '';
  if (!content) throw new Error('Could not find response message in BAF history');
  return content;
}
