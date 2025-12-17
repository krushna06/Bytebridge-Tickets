import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Manage ticket tags')
    .addSubcommand((s) => s.setName('create').setDescription('Create a tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List tags'))
    .addSubcommand((s) => s.setName('apply').setDescription('Apply a tag to a ticket').addStringOption((o) => o.setName('tag').setDescription('Tag name').setRequired(true))),
  async execute(interaction: any, ctx: any) {
    return handlers.tag(interaction, ctx);
  }
};
