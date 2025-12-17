import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import commandsList from './index';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID;

const commands = (commandsList as any[]).map((c: any) => c.data.toJSON());

commands.forEach((cmd: any, idx: number) => {
  try {
    const opts = (cmd.options || []).map((o: any) => ({ name: o.name, required: !!o.required }));
    console.log(`cmd[${idx}] ${cmd.name} options:`, JSON.stringify(opts));
    if (cmd.options) cmd.options.forEach((o: any, i: number) => {
      if (!o.required) {
        const laterRequired = (cmd.options as any[]).slice(i+1).some((x: any) => x.required);
        if (laterRequired) console.warn(`Warning: command ${cmd.name} has optional option '${o.name}' before a required option later.`);
      }
    });
  } catch (e) { /* ignore */ }
});

if (commands[7]) {
  console.log('DEBUG: command[7] payload:\n', JSON.stringify(commands[7], null, 2));
}

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  console.log('Deploying commands...');
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Deployed to guild', guildId);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Deployed globally (may take up to an hour)');
  }
}

deploy().catch(err => {
  console.error(err);
  process.exit(1);
});
