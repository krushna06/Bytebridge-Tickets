import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create or manage a ticket panel')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a ticket panel')
        .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(false))
        .addStringOption(o => o.setName('button1').setDescription('Button label 1').setRequired(false))
        .addStringOption(o => o.setName('button2').setDescription('Button label 2').setRequired(false))
        .addStringOption(o => o.setName('button3').setDescription('Button label 3').setRequired(false))
        .addStringOption(o => o.setName('button4').setDescription('Button label 4').setRequired(false))
        .addStringOption(o => o.setName('button5').setDescription('Button label 5').setRequired(false))
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.panel(interaction, ctx);
  }
};
