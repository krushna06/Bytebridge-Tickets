import { createTicketRow } from '../src/lib/database';

async function run() {
  try {
    const id = createTicketRow({
      guildId: 'test-guild',
      channelId: 'test-channel-' + Date.now(),
      userId: 'test-user',
      status: 'open',
      createdAt: Date.now(),
    });
    console.log('Inserted ticket id:', id);
  } catch (err) {
    console.error('Error creating ticket:', err);
    process.exitCode = 1;
  }
}

run();
