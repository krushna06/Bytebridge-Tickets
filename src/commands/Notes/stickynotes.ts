import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Notes',
  data: new SlashCommandBuilder()
    .setName('stickynotes')
    .setDescription('Manage sticky notes for tickets')
    .addSubcommand((s) => s.setName('list').setDescription('List sticky notes').addUserOption((o) => o.setName('user').setDescription('User to list notes for').setRequired(false)))
    .addSubcommand((s) => s.setName('add').setDescription('Add a sticky note').addUserOption((o) => o.setName('user').setDescription('User to attach note to').setRequired(true)).addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a sticky note').addIntegerOption((o) => o.setName('id').setDescription('Note id').setRequired(true))),
  async execute(interaction: any, ctx: any) {
    return handlers.stickynotes(interaction, ctx);
  }
};
