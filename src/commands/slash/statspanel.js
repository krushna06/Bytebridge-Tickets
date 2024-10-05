const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getAvgResolutionTime, getAvgResponseTime } = require('../../lib/stats');
const profilesPath = path.join(__dirname, '../../../db/json/profiles.json');

module.exports = class StatsPanelSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'statspanel';
        super(client, {
            ...options,
            description: 'Displays ticket stats and user profiles in a panel.',
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

        await interaction.reply({ content: 'Fetching stats and profiles...', ephemeral: false });

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

        const fetchProfiles = async () => {
            let profiles;
            try {
                profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
            } catch (error) {
                client.log.error('Error loading profiles:', error);
                return null;
            }

            return profiles;
        };

        const convertMsToMinutes = (ms) => {
            return (ms / 60000).toFixed(2);
        };

        const createEmbed = async (avgResolutionTime, avgResponseTime, totalTickets, profiles) => {
            const profileEmbed = new EmbedBuilder()
                .setTitle('Ticket Statistics and User Profiles')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Average Resolution Time', value: `${convertMsToMinutes(avgResolutionTime)} minutes`, inline: true },
                    { name: 'Average Response Time', value: `${convertMsToMinutes(avgResponseTime)} minutes`, inline: true },
                    { name: 'Total Tickets Closed', value: `${totalTickets}`, inline: true }
                )
                .setTimestamp();

            if (profiles) {
                for (const [userId, profile] of Object.entries(profiles)) {
                    try {
                        const user = await interaction.guild.members.fetch(userId);
                        const username = user.user.username;

                        profileEmbed.addFields({
                            name: username,
                            value: `Bio: ${profile.bio || 'Not set'}, Timezone: ${profile.timezone || 'Not set'}`,
                            inline: true,
                        });
                    } catch (error) {
                        console.error(`Could not fetch user with ID ${userId}:`, error);
                    }
                }
            } else {
                profileEmbed.addFields({
                    name: 'Profiles',
                    value: 'No profiles found.',
                    inline: false,
                });
            }

            return profileEmbed;
        };

        const initialStats = await fetchStats();
        const profiles = await fetchProfiles();

        if (!initialStats) {
            await interaction.editReply('An error occurred while fetching stats. Please try again later.');
            return;
        }

        let statsMessage;
        try {
            const guildChannel = await client.channels.fetch('899659621097152563');
            statsMessage = await guildChannel.messages.fetch({ limit: 10 }).then(messages =>
                messages.find(msg => msg.embeds.length > 0 && msg.embeds[0].title === 'Ticket Statistics and User Profiles')
            );

            if (statsMessage) {
                await statsMessage.edit({
                    embeds: [await createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets, profiles)],
                });
            }
        } catch (error) {
            client.log.error('Could not fetch existing stats message:', error);
        }

        if (!statsMessage) {
            const guildChannel = await client.channels.fetch('899659621097152563');
            statsMessage = await guildChannel.send({
                embeds: [await createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets, profiles)],
            });
        }

        const updateInterval = setInterval(async () => {
            const updatedStats = await fetchStats();
            const updatedProfiles = await fetchProfiles();
            if (updatedStats) {
                await statsMessage.edit({
                    embeds: [await createEmbed(updatedStats.avgResolutionTime, updatedStats.avgResponseTime, updatedStats.totalTickets, updatedProfiles)],
                });
            }
        }, 60000);  // 1 minute

        interaction.channel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000, errors: ['time'] })
            .then(() => clearInterval(updateInterval))
            .catch(() => clearInterval(updateInterval));
    }
};
