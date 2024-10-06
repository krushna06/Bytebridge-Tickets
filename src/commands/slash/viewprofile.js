const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const {
    getAvgResolutionTimePerUser,
    getAvgResponseTimePerUser,
} = require('../../lib/stats');
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

        const TARGET_GUILD_ID = '877062059966206002';
        const guild = await interaction.client.prisma.guild.findUnique({
            include: {
                tickets: {
                    select: {
                        claimedById: true,
                        closedAt: true,
                        createdAt: true,
                        firstResponseAt: true,
                    },
                },
            },
            where: { id: TARGET_GUILD_ID },
        });

        const closedTickets = guild.tickets.filter(t => t.firstResponseAt && t.closedAt);

        const avgResponseTimePerUser = getAvgResponseTimePerUser(closedTickets);
        const avgResolutionTimePerUser = getAvgResolutionTimePerUser(closedTickets);

        const feedbackRows = await interaction.client.prisma.feedback.findMany({
            select: {
                rating: true,
                userId: true
            },
            where: {
                guildId: TARGET_GUILD_ID
            }
        });

        const feedbackStats = {};
        feedbackRows.forEach(row => {
            if (!feedbackStats[row.userId]) {
                feedbackStats[row.userId] = { totalRating: 0, count: 0 };
            }
            feedbackStats[row.userId].totalRating += row.rating;
            feedbackStats[row.userId].count++;
        });

        const avgFeedbackPerUser = {};
        Object.keys(feedbackStats).forEach(userId => {
            avgFeedbackPerUser[userId] = feedbackStats[userId].totalRating / feedbackStats[userId].count;
        });

        const userResponseTime = avgResponseTimePerUser[userId];
        const userResolutionTime = avgResolutionTimePerUser[userId];
        const userFeedback = avgFeedbackPerUser[userId];

        const profileEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setDescription(`Profile Details for <@${userId}>`)
            .addFields(
                { name: 'Bio', value: userProfile.bio || 'Not set', inline: true },
                { name: 'Timezone', value: userProfile.timezone || 'Not set', inline: true },
                { name: 'Active Hours', value: userProfile.activeHours || 'Not set', inline: true },
                { name: 'Portfolio', value: userProfile.portfolio ? userProfile.portfolio : 'Not set', inline: true },
                { name: 'Avg Response Time', value: userResponseTime ? `${convertMsToSeconds(userResponseTime)} seconds` : 'No data', inline: true },
                { name: 'Avg Resolution Time', value: userResolutionTime ? `${convertMsToSeconds(userResolutionTime)} seconds` : 'No data', inline: true },
                { name: 'Avg Feedback', value: userFeedback ? `${userFeedback.toFixed(1)}/5` : 'No data', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'User Profile', iconURL: interaction.guild.iconURL() || '' });

        await interaction.reply({
            embeds: [profileEmbed],
            ephemeral: true,
        });
    }
};

const convertMsToSeconds = (ms) => {
    return (ms / 1000).toFixed(2);
};
