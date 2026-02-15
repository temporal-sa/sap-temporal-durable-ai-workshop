import { proxyActivities, log, sleep, defineQuery, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import type { BafConfig } from './activities';

const { invokeBAF, checkState, getTrace, getResult } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  // Default retry policy handles transient HTTP failures automatically
});

// Query handler — replaces eventBus.publish() from BafAgentClient.ts.
// Check status from Temporal UI or CLI: temporal workflow query --workflow-id <id> --name getStatus
export const getStatusQuery = defineQuery<string>('getStatus');

/**
 * Durable dispute resolution workflow.
 *
 * Same logic as BafAgentClient.ts (invokeAgentSync + triggerStatusUpdate) but every
 * step is checkpointed by Temporal. Kill the worker mid-poll, restart it, and the
 * workflow resumes from the last completed activity — chatId/historyId restored from
 * event history, not re-fetched.
 *
 * Config uses mock BAF defaults. For real BAF, swap the values below.
 */
export async function disputeResolutionWorkflow(disputeMessage: string): Promise<string> {
  // Mock BAF defaults — swap for real BAF credentials in production
  const config: BafConfig = {
    bafUrl: 'http://localhost:3001',
    agentId: 'mock-agent-001',
    tokenUrl: 'http://localhost:3001/oauth/token',
    clientId: 'mock-client',
    clientSecret: 'mock-secret',
  };

  let currentStatus = 'starting';
  let pollCount = 0;

  // Register query handler so participants can check status from UI/CLI
  setHandler(getStatusQuery, () => currentStatus);

  // Step 1: Create BAF chat and send message — maps to invokeAgentSync()
  // After this completes, chatId/historyId are DURABLE (stored in event history).
  // In BafAgentClient.ts these were local variables — crash = lost.
  log.info('Invoking BAF agent', { message: disputeMessage });
  currentStatus = 'invoking BAF';
  const { chatId, historyId } = await invokeBAF(config, `dispute-${Date.now()}`, disputeMessage);
  log.info('BAF chat created', { chatId, historyId });

  // Step 2: Polling loop — same structure as BafAgentClient.triggerStatusUpdate() (lines 43-136)
  // Every iteration is checkpointed. Kill the worker, restart, and it resumes here.
  while (true) {
    pollCount++;
    const state = await checkState(config, chatId);
    log.info(`Poll #${pollCount}`, { state });

    switch (state) {
      case 'none':
      case 'pending':
        currentStatus = `pending (poll #${pollCount})`;
        break;

      case 'running': {
        const trace = await getTrace(config, chatId, historyId);
        currentStatus = `running (poll #${pollCount}): ${trace.slice(0, 100)}...`;
        log.info('Agent thinking', { trace: trace.slice(0, 200) });
        break;
      }

      case 'success': {
        currentStatus = 'success — fetching result';
        const result = await getResult(config, chatId, historyId);
        currentStatus = 'completed';
        log.info('Dispute resolved', { resultLength: result.length });
        return result;
      }

      case 'error':
        currentStatus = 'error';
        throw new Error(`BAF agent returned error state at poll #${pollCount}`);
    }

    // Durable timer — survives worker crashes. In BafAgentClient.ts this was setTimeout (line 162).
    await sleep('1500ms');
  }
}
