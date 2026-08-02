import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Staff',
  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Set ticket priority')
    .addStringOption((o) =>
      o
        .setName('level')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: 'low', value: 'low' },
          { name: 'normal', value: 'normal' },
          { name: 'high', value: 'high' },
          { name: 'urgent', value: 'urgent' }
        )
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.priority(interaction, ctx);
  }
};
