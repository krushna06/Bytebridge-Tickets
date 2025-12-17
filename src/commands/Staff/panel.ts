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
        .addChannelOption(o => o.setName('post_channel').setDescription('Post the panel to this channel immediately').setRequired(false))
        .addStringOption(o => o.setName('button1').setDescription('Button label 1').setRequired(false))
        .addChannelOption(o => o.setName('button1_category').setDescription('Category for button1').setRequired(false))
        .addStringOption(o => o.setName('button2').setDescription('Button label 2').setRequired(false))
        .addChannelOption(o => o.setName('button2_category').setDescription('Category for button2').setRequired(false))
        .addStringOption(o => o.setName('button3').setDescription('Button label 3').setRequired(false))
        .addChannelOption(o => o.setName('button3_category').setDescription('Category for button3').setRequired(false))
        .addStringOption(o => o.setName('button4').setDescription('Button label 4').setRequired(false))
        .addChannelOption(o => o.setName('button4_category').setDescription('Category for button4').setRequired(false))
        .addStringOption(o => o.setName('button5').setDescription('Button label 5').setRequired(false))
        .addChannelOption(o => o.setName('button5_category').setDescription('Category for button5').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List saved panels for this guild')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a saved panel (and remove posted message if present)')
        .addIntegerOption(o => o.setName('id').setDescription('Panel id to delete').setRequired(false))
        .addChannelOption(o => o.setName('channel').setDescription('Channel where panel message is posted').setRequired(false))
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.panel(interaction, ctx);
  }
};
