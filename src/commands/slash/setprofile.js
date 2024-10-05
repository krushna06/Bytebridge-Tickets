const { SlashCommand } = require('@eartharoid/dbf');
const fs = require('fs');
const path = require('path');
const profilesPath = path.join(__dirname, '../../../db/json/profiles.json');

module.exports = class SetProfileSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'setprofile';
        super(client, {
            ...options,
            description: 'Set your user profile details like bio, timezone, active hours, and portfolio.',
            dmPermission: true,
            name,
            options: [
                {
                    name: 'bio',
                    type: 3, // STRING
                    description: 'Set your bio',
                    required: true,
                },
                {
                    name: 'timezone',
                    type: 3, // STRING
                    description: 'Set your timezone (e.g., GMT+2, UTC-5)',
                    required: true,
                },
                {
                    name: 'active_hours',
                    type: 3, // STRING
                    description: 'Set your active hours (e.g., 9am-5pm)',
                    required: true,
                },
                {
                    name: 'portfolio',
                    type: 3, // STRING
                    description: 'Set a link to your portfolio (optional)',
                    required: false,
                },
            ],
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        const userId = interaction.user.id;
        const bio = interaction.options.getString('bio');
        const timezone = interaction.options.getString('timezone');
        const activeHours = interaction.options.getString('active_hours');
        const portfolio = interaction.options.getString('portfolio') || null;

        let profiles;
        try {
            profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        } catch (error) {
            profiles = {};
        }

        profiles[userId] = {
            bio,
            timezone,
            activeHours,
            portfolio,
        };

        fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

        await interaction.reply({
            content: 'Your profile has been updated successfully!',
            ephemeral: true,
        });
    }
};
