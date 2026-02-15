import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'dispute-resolution',
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    console.log('Worker started — listening on task queue: dispute-resolution');
    console.log('Temporal UI: http://localhost:8233');
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
