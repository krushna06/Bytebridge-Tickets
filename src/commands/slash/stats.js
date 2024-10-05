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
                            },
                        },
                    },
                });

                const closedTickets = guild.tickets.filter(t => t.firstResponseAt && t.closedAt);
                const avgResolutionTime = getAvgResolutionTime(closedTickets);
                const avgResponseTime = getAvgResponseTime(closedTickets);
                const totalTickets = closedTickets.length;

                return { avgResolutionTime, avgResponseTime, totalTickets };
            } catch (error) {
                client.log.error('Error fetching stats:', error);
                return null;
            }
        };

        const convertMsToMinutes = (ms) => {
            return (ms / 60000).toFixed(2);
        };

        const createEmbed = (avgResolutionTime, avgResponseTime, totalTickets) => {
            return new EmbedBuilder()
                .setTitle('Ticket Statistics')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Average Resolution Time', value: `${convertMsToMinutes(avgResolutionTime)} minutes`, inline: true },
                    { name: 'Average Response Time', value: `${convertMsToMinutes(avgResponseTime)} minutes`, inline: true },
                    { name: 'Total Tickets Closed', value: `${totalTickets}`, inline: true }
                )
                .setTimestamp();
        };

        const initialStats = await fetchStats();
        if (!initialStats) {
            await interaction.editReply('An error occurred while fetching stats. Please try again later.');
            return;
        }

        // try finding the stats message in the guild
        let statsMessage;
        try {
            const guildChannel = await client.channels.fetch('899659621097152563');
            statsMessage = await guildChannel.messages.fetch({ limit: 10 }).then(messages =>
                messages.find(msg => msg.embeds.length > 0 && msg.embeds[0].title === 'Ticket Statistics')
            );
            if (statsMessage) {
                await statsMessage.edit({
                    embeds: [createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets)],
                });
            }
        } catch (error) {
            client.log.error('Could not fetch existing stats message:', error);
        }

        // if no existing message, send a new one
        if (!statsMessage) {
            const guildChannel = await client.channels.fetch('899659621097152563');
            statsMessage = await guildChannel.send({
                embeds: [createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets)],
            });
        }

        const updateInterval = setInterval(async () => {
            const updatedStats = await fetchStats();
            if (updatedStats) {
                await statsMessage.edit({
                    embeds: [createEmbed(updatedStats.avgResolutionTime, updatedStats.avgResponseTime, updatedStats.totalTickets)],
                });
            }
        }, 60000);  // 1 minute

        interaction.channel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000, errors: ['time'] })
            .then(() => clearInterval(updateInterval))
            .catch(() => clearInterval(updateInterval));
    }
};
