import { Connection, Client } from '@temporalio/client';
import { disputeResolutionWorkflow } from './workflows';
import { nanoid } from 'nanoid';

async function run() {
  const message =
    process.argv[2] ||
    'Ali from XStore disputes order ORD0006. They ordered 1000 units but only received 900. Please investigate and resolve.';

  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new Client({ connection });

  const workflowId = `dispute-${nanoid()}`;

  const handle = await client.workflow.start(disputeResolutionWorkflow, {
    taskQueue: 'dispute-resolution',
    args: [message],
    workflowId,
  });

  console.log(`Started workflow: ${workflowId}`);
  console.log(`Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}`);
  console.log('Waiting for result...\n');

  const result = await handle.result();
  console.log('=== Dispute Resolution Result ===\n');
  console.log(result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
