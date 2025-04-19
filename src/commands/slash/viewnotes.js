const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

module.exports = class ViewNotesSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'viewnotes';
        super(client, {
            ...options,
            description: 'View notes for a specific user',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'member',
                    description: 'The member to view notes for',
                    required: true,
                    type: ApplicationCommandOptionType.User,
                },
            ],
        });
    }

    async run(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!(await isStaff(interaction.guild, interaction.user.id))) {
            return await interaction.editReply({
                embeds: [
                    new ExtendedEmbedBuilder()
                        .setColor('Red')
                        .setTitle('❌ Access Denied')
                        .setDescription('Only staff members can view notes.'),
                ],
            });
        }

        const member = interaction.options.getMember('member', true);

        const notes = await this.client.prisma.note.findMany({
            where: {
                targetId: member.id,
                guildId: interaction.guild.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (notes.length === 0) {
            return await interaction.editReply({
                embeds: [
                    new ExtendedEmbedBuilder()
                        .setColor('Blue')
                        .setTitle('📝 No Notes Found')
                        .setDescription(`There are no notes for ${member.toString()}`),
                ],
            });
        }

        const embed = new ExtendedEmbedBuilder()
            .setColor('Blue')
            .setTitle(`📝 Notes for ${member.user.username}`)
            .setDescription(
                notes.map(note => {
                    const timestamp = `<t:${Math.floor(note.createdAt.getTime() / 1000)}:R>`;
                    return `**Created by:** ${note.creatorName}\n**When:** ${timestamp}\n**Note:** ${note.content}\n`;
                }).join('\n─────────────────\n')
            );

        return await interaction.editReply({ embeds: [embed] });
    }
};