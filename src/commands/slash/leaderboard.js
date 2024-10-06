const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const {
    getAvgResolutionTimePerUser,
    getAvgResponseTimePerUser
} = require('../../lib/stats');

module.exports = class LeaderboardSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'leaderboard';
        super(client, {
            ...options,
            description: 'Displays user leaderboard or individual stats based on response, resolution times, or feedback.',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'type',
                    description: 'The type of leaderboard',
                    required: true,
                    type: 3, // String option
                    choices: [
                        { name: 'Response Time', value: 'response' },
                        { name: 'Resolution Time', value: 'resolve' },
                        { name: 'Avg Feedback', value: 'feedback' }
                    ]
                },
                {
                    name: 'member',
                    description: 'Specific member to show stats for (optional)',
                    required: false,
                    type: 6 // User option
                }
            ],
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        const client = this.client;
        const leaderboardType = interaction.options.getString('type');
        const member = interaction.options.getUser('member');

        await interaction.reply({ content: 'Fetching leaderboard or user stats...', ephemeral: false });

        const TARGET_GUILD_ID = '877062059966206002';

        const fetchStats = async () => {
            try {
                const guild = await client.prisma.guild.findUnique({
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

                const avgResolutionTimePerUser = getAvgResolutionTimePerUser(closedTickets);
                const avgResponseTimePerUser = getAvgResponseTimePerUser(closedTickets);

                return { avgResolutionTimePerUser, avgResponseTimePerUser };
            } catch (error) {
                client.log.error('Error fetching stats:', error);
                return null;
            }
        };

        const fetchFeedbackStats = async () => {
            try {
                const rows = await client.prisma.feedback.findMany({
                    select: {
                        rating: true,
                        userId: true
                    },
                    where: {
                        guildId: TARGET_GUILD_ID
                    }
                });

                const feedbackStats = {};
                rows.forEach(row => {
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

                return avgFeedbackPerUser;
            } catch (error) {
                client.log.error('Error fetching feedback stats:', error);
                return null;
            }
        };

        const stats = await fetchStats();
        const feedbackStats = await fetchFeedbackStats();

        if (!stats && !feedbackStats) {
            await interaction.editReply('An error occurred while fetching stats. Please try again later.');
            return;
        }

        const { avgResolutionTimePerUser, avgResponseTimePerUser } = stats || {};

        const createLeaderboardEmbed = async (type, user) => {
            const embed = new EmbedBuilder()
                .setTitle(`User Leaderboard - ${type === 'response' ? 'Response Time' : type === 'resolve' ? 'Resolution Time' : 'Avg Feedback'}`)
                .setColor(0x00AE86)
                .setTimestamp();

            let userStats;
            if (type === 'response') {
                userStats = avgResponseTimePerUser;
            } else if (type === 'resolve') {
                userStats = avgResolutionTimePerUser;
            } else if (type === 'feedback') {
                userStats = feedbackStats;
            }

            if (user) {
                const stat = userStats[user.id];
                if (!stat) {
                    embed.setDescription(`No data available for ${user.username} in the ${type} leaderboard.`);
                } else {
                    embed.addFields({
                        inline: false,
                        name: `${user.username}'s Stats`,
                        value: `${type === 'feedback' ? `Avg Feedback: ${stat.toFixed(1)}/5` : `Avg ${type === 'response' ? 'Response' : 'Resolution'} Time: ${convertMsToSeconds(stat)} seconds`}`,
                    });
                }
            } else {
                const sortedUsers = Object.keys(userStats)
                    .map(userId => ({ stat: userStats[userId], userId }))
                    .filter(user => user.stat !== undefined)
                    .sort((a, b) => type === 'feedback' ? b.stat - a.stat : a.stat - b.stat)
                    .slice(0, 10);

                if (sortedUsers.length === 0) {
                    embed.setDescription('No data available for this leaderboard.');
                } else {
                    for (const [index, userEntry] of sortedUsers.entries()) {
                        try {
                            const userMember = await interaction.guild.members.fetch(userEntry.userId);
                            const username = userMember.user.username;

                            embed.addFields({
                                inline: false,
                                name: `#${index + 1} - ${username}`,
                                value: `${type === 'feedback' ? `Avg Feedback: ${userEntry.stat.toFixed(1)}/5` : `Avg ${type === 'response' ? 'Response' : 'Resolution'} Time: ${convertMsToSeconds(userEntry.stat)} seconds`}`,
                            });
                        } catch (error) {
                            client.log.error(`Could not fetch user with ID ${userEntry.userId}:`, error);
                        }
                    }
                }
            }

            return embed;
        };

        const leaderboardEmbed = await createLeaderboardEmbed(leaderboardType, member);

        await interaction.editReply({ embeds: [leaderboardEmbed] });
    }
};

const convertMsToSeconds = (ms) => {
    return (ms / 1000).toFixed(2);
};
