const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = class LeaderboardSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'leaderboard';
        super(client, {
            ...options,
            description: 'View the support staff leaderboard',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'range',
                    type: ApplicationCommandOptionType.String,
                    description: 'Time range for the leaderboard',
                    required: true,
                    choices: [
                        { name: 'Last 24 Hours', value: '24h' },
                        { name: 'Last 7 Days', value: '7d' },
                        { name: 'Last 30 Days', value: '30d' },
                        { name: 'Last 90 Days', value: '90d' },
                    ],
                },
                {
                    name: 'metric',
                    type: ApplicationCommandOptionType.String,
                    description: 'Metric to rank by',
                    required: true,
                    choices: [
                        { name: 'Average Response Time', value: 'response_time' },
                        { name: 'Total Tickets Solved', value: 'tickets_solved' },
                        { name: 'Average Rating', value: 'rating' },
                    ],
                },
            ],
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        const range = interaction.options.getString('range');
        const metric = interaction.options.getString('metric');
        const guildId = interaction.guildId;

        // Calculate the date range
        const now = new Date();
        const startDate = new Date(now.getTime() - ms(range));

        try {
            let leaderboardData;
            let title;
            let valueFormatter;

            switch (metric) {
                case 'response_time': {
                    // Get tickets closed by staff with first response time
                    const tickets = await interaction.client.prisma.ticket.findMany({
                        where: {
                            guildId,
                            closedAt: { gte: startDate },
                            firstResponseAt: { not: null },
                            closedById: { not: null },
                        },
                        select: {
                            firstResponseAt: true,
                            createdAt: true,
                            closedById: true,
                        },
                    });

                    // Calculate average response time per staff member
                    const staffResponseTimes = tickets.reduce((acc, ticket) => {
                        const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
                        if (!acc[ticket.closedById]) {
                            acc[ticket.closedById] = { total: 0, count: 0 };
                        }
                        acc[ticket.closedById].total += responseTime;
                        acc[ticket.closedById].count += 1;
                        return acc;
                    }, {});

                    // Convert to array and sort
                    leaderboardData = Object.entries(staffResponseTimes)
                        .map(([userId, data]) => ({
                            userId,
                            value: data.total / data.count,
                        }))
                        .sort((a, b) => a.value - b.value);

                    title = 'Average Response Time Leaderboard';
                    valueFormatter = (value) => ms(value, { long: true });
                    break;
                }

                case 'tickets_solved': {
                    // Count tickets closed by each staff member
                    const tickets = await interaction.client.prisma.ticket.groupBy({
                        by: ['closedById'],
                        where: {
                            guildId,
                            closedAt: { gte: startDate },
                            closedById: { not: null },
                        },
                        _count: true,
                    });

                    leaderboardData = tickets
                        .map(ticket => ({
                            userId: ticket.closedById,
                            value: ticket._count,
                        }))
                        .sort((a, b) => b.value - a.value);

                    title = 'Tickets Solved Leaderboard';
                    valueFormatter = (value) => `${value} tickets`;
                    break;
                }

                case 'rating': {
                    // Get feedback ratings for each staff member
                    const feedback = await interaction.client.prisma.feedback.groupBy({
                        by: ['userId'],
                        where: {
                            guildId,
                            createdAt: { gte: startDate },
                            userId: { not: null },
                        },
                        _avg: { rating: true },
                    });

                    leaderboardData = feedback
                        .map(f => ({
                            userId: f.userId,
                            value: f._avg.rating,
                        }))
                        .sort((a, b) => b.value - a.value);

                    title = 'Average Rating Leaderboard';
                    valueFormatter = (value) => `${value.toFixed(1)}/5`;
                    break;
                }
            }

            if (leaderboardData.length === 0) {
                return await interaction.reply({
                    content: 'No data available for the selected time range and metric.',
                    ephemeral: true,
                });
            }

            // Create the leaderboard embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${title} (${range})`)
                .setDescription('Top 10 Support Staff Members');

            // Add top 10 entries to the embed
            for (let i = 0; i < Math.min(10, leaderboardData.length); i++) {
                const entry = leaderboardData[i];
                const user = await interaction.guild.members.fetch(entry.userId).catch(() => null);
                const username = user ? user.user.username : 'Unknown User';

                embed.addFields({
                    name: `${i + 1}. ${username} - ${valueFormatter(entry.value)}`,
                    value: '\u200b', // Zero-width space to make the field appear
                    inline: false,
                });
            }

            await interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error generating leaderboard:', error);
            await interaction.reply({
                content: 'An error occurred while generating the leaderboard. Please try again later.',
                ephemeral: true,
            });
        }
    }
}; 