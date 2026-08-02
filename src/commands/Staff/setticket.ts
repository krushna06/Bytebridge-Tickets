import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Staff',
  data: new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Convert an existing channel into a ticket channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to convert into a ticket')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to assign as the ticket owner (defaults to you)')
        .setRequired(false)
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.setticket(interaction, ctx);
  }
};
