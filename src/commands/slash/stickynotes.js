const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const { randomBytes } = require('crypto');

module.exports = class StickyNotesSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'stickynotes';
        super(client, {
            ...options,
            description: 'Create a note for a specific user',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'member',
                    description: 'The member to create a note for',
                    required: true,
                    type: ApplicationCommandOptionType.User,
                },
                {
                    name: 'note',
                    description: 'The note content',
                    required: true,
                    type: ApplicationCommandOptionType.String,
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
                        .setDescription('Only staff members can create notes.'),
                ],
            });
        }

        const member = interaction.options.getMember('member', true);
        const noteContent = interaction.options.getString('note', true);

        // Generate a random ID for the note
        const noteId = randomBytes(8).toString('hex');

        await this.client.prisma.note.create({
            data: {
                id: noteId,
                content: noteContent,
                creatorId: interaction.user.id,
                creatorName: interaction.user.username,
                targetId: member.id,
                guildId: interaction.guild.id,
            },
        });

        return await interaction.editReply({
            embeds: [
                new ExtendedEmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ Note Created')
                    .setDescription(`Created a note for ${member.toString()}`),
            ],
        });
    }
};