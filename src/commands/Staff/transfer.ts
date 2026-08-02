import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Staff',
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer a ticket to another user')
    .addUserOption((o) => o.setName('user').setDescription('User to transfer to').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.transfer(interaction, ctx);
  }
};
