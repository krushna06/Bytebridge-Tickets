import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('sendpanel')
    .setDescription('Send the latest saved ticket panel to a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send panel to').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.sendpanel(interaction, ctx);
  }
};
