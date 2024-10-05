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
            description: 'Displays user leaderboard based on response or resolution times.',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'type',
                    type: 3,
                    description: 'The type of leaderboard',
                    required: true,
                    choices: [
                        { name: 'Response Time', value: 'response' },
                        { name: 'Resolution Time', value: 'resolve' }
                    ]
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

        await interaction.reply({ content: 'Fetching leaderboard...', ephemeral: false });

        const TARGET_GUILD_ID = '877062059966206002';

        const fetchStats = async () => {
            try {
                const guild = await client.prisma.guild.findUnique({
                    where: { id: TARGET_GUILD_ID },
                    include: {
                        tickets: {
                            select: {
                                closedAt: true,
                                createdAt: true,
                                firstResponseAt: true,
                                claimedById: true,
                            },
                        },
                    },
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

        const stats = await fetchStats();

        if (!stats) {
            await interaction.editReply('An error occurred while fetching stats. Please try again later.');
            return;
        }

        const { avgResolutionTimePerUser, avgResponseTimePerUser } = stats;

        const createLeaderboardEmbed = async (type) => {
			const embed = new EmbedBuilder()
				.setTitle(`User Leaderboard - ${type === 'response' ? 'Response Time' : 'Resolution Time'}`)
				.setColor(0x00AE86)
				.setTimestamp();

			const userStats = type === 'response' ? avgResponseTimePerUser : avgResolutionTimePerUser;
			const sortedUsers = Object.keys(userStats)
				.map(userId => ({ userId, time: userStats[userId] }))
				.filter(user => user.time !== undefined)
				.sort((a, b) => a.time - b.time)
				.slice(0, 10);

			if (sortedUsers.length === 0) {
				embed.setDescription('No data available for this leaderboard.');
			} else {
				for (const [index, user] of sortedUsers.entries()) {
					try {
						const userMember = await interaction.guild.members.fetch(user.userId);
						const username = userMember.user.username;

						embed.addFields({
							name: `#${index + 1} - ${username}`,
							value: `${type === 'response' ? 'Avg Response Time' : 'Avg Resolution Time'}: ${convertMsToSeconds(user.time)} seconds`,
							inline: false,
						});
					} catch (error) {
						console.error(`Could not fetch user with ID ${user.userId}:`, error);
					}
				}
			}

			return embed;
		};


        const leaderboardEmbed = await createLeaderboardEmbed(leaderboardType);

        await interaction.editReply({ embeds: [leaderboardEmbed] });
    }
};

const convertMsToSeconds = (ms) => {
    return (ms / 1000).toFixed(2);
};
