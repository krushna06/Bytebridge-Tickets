import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Staff',
  data: new SlashCommandBuilder()
    .setName('sendpanel')
    .setDescription('Send a saved panel to a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send the panel to').setRequired(true))
    .addIntegerOption(o => o.setName('panel_id').setDescription('Panel id to send (if omitted, latest panel will be used)').setRequired(false))
    .addBooleanOption(o => o.setName('include_stats').setDescription('Include stats embed with the panel').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.sendpanel(interaction, ctx);
  }
};

