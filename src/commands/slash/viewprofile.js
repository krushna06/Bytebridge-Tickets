const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const profilesPath = path.join(__dirname, '../../../db/json/profiles.json');

module.exports = class ViewProfileSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'viewprofile';
        super(client, {
            ...options,
            description: 'View your user profile details or someone else\'s by mentioning them.',
            dmPermission: true,
            name,
            options: [
                {
                    name: 'member',
                    type: ApplicationCommandOptionType.User,
                    required: false,
                    description: 'Mention a user to view their profile',
                },
            ],
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        const userId = interaction.options.getUser('member')?.id || interaction.user.id;

        let profiles;
        try {
            profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        } catch (error) {
            return await interaction.reply({
                content: 'An error occurred while loading the profile data.',
                ephemeral: true,
            });
        }

        const userProfile = profiles[userId];
        if (!userProfile) {
            return await interaction.reply({
                content: 'This user does not have a profile yet. Use `/setprofile` to create one.',
                ephemeral: true,
            });
        }

        const profileEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setDescription(`Profile Details for <@${userId}>`)
            .addFields(
                { name: 'Bio', value: userProfile.bio || 'Not set', inline: true },
                { name: 'Timezone', value: userProfile.timezone || 'Not set', inline: true },
                { name: 'Active Hours', value: userProfile.activeHours || 'Not set', inline: true },
                { name: 'Portfolio', value: userProfile.portfolio ? userProfile.portfolio : 'Not set', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'User Profile', iconURL: interaction.guild.iconURL() || '' });

        await interaction.reply({
            embeds: [profileEmbed],
            ephemeral: true,
        });
    }
};
