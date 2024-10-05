const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const { getAvgResolutionTime, getAvgResponseTime } = require('../../lib/stats');

module.exports = class StatsSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'stats';
        super(client, {
            ...options,
            description: 'Shows and updates the ticket stats.',
            dmPermission: false,
            name,
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        /** @type {import("client")} */
        const client = this.client;

        await interaction.reply({ content: 'Fetching stats...', ephemeral: false });

        const fetchStats = async () => {
            try {
                const guilds = await client.prisma.guild.findMany({
                    include: {
                        tickets: {
                            select: {
                                closedAt: true,
                                createdAt: true,
                                firstResponseAt: true,
                            },
                        },
                    },
                });

                const closedTickets = guilds.flatMap(guild => guild.tickets.filter(t => t.firstResponseAt && t.closedAt));
                const avgResolutionTime = getAvgResolutionTime(closedTickets);
                const avgResponseTime = getAvgResponseTime(closedTickets);
                const totalTickets = closedTickets.length;

                return { avgResolutionTime, avgResponseTime, totalTickets };
            } catch (error) {
                client.log.error('Error fetching stats:', error);
                return null;
            }
        };

        const createEmbed = (avgResolutionTime, avgResponseTime, totalTickets) => {
            return new EmbedBuilder()
                .setTitle('Ticket Statistics')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Average Resolution Time', value: `${Math.round(avgResolutionTime)} minutes`, inline: true },
                    { name: 'Average Response Time', value: `${Math.round(avgResponseTime)} minutes`, inline: true },
                    { name: 'Total Tickets Closed', value: `${totalTickets}`, inline: true }
                )
                .setTimestamp();
        };

        const initialStats = await fetchStats();
        if (!initialStats) {
            await interaction.editReply('An error occurred while fetching stats. Please try again later.');
            return;
        }

        const statsMessage = await interaction.channel.send({
            embeds: [createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets)],
        });

        const updateInterval = setInterval(async () => {
            const updatedStats = await fetchStats();
            if (updatedStats) {
                await statsMessage.edit({
                    embeds: [createEmbed(updatedStats.avgResolutionTime, updatedStats.avgResponseTime, updatedStats.totalTickets)],
                });
            }
        }, 60000);  // 1 minute
    }
};
