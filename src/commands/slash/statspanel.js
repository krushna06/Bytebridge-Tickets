const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const {
    getAvgResolutionTimePerUser,
    getAvgResponseTimePerUser
} = require('../../lib/stats');
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
                                claimedById: true,
                            },
                        },
                    },
                });

                const closedTickets = guild.tickets.filter(t => t.firstResponseAt && t.closedAt);

                const avgResolutionTimePerUser = getAvgResolutionTimePerUser(closedTickets);
                const avgResponseTimePerUser = getAvgResponseTimePerUser(closedTickets);
                const totalTickets = closedTickets.length;

                return { avgResolutionTimePerUser, avgResponseTimePerUser, totalTickets };
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

        const convertMsToSeconds = (ms) => {
            return (ms / 1000).toFixed(2);
        };

        const createEmbed = async (avgResolutionTimePerUser, avgResponseTimePerUser, totalTickets, profiles) => {
            const profileEmbed = new EmbedBuilder()
                .setTitle('Ticket Statistics and User Profiles')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Total Tickets Closed', value: `${totalTickets}`, inline: true }
                )
                .setTimestamp();

            let totalResponseTime = 0;
            let totalResolutionTime = 0;
            let responseCount = 0;
            let resolutionCount = 0;

            for (const userId in avgResponseTimePerUser) {
                if (avgResponseTimePerUser[userId]) {
                    totalResponseTime += avgResponseTimePerUser[userId];
                    responseCount++;
                }
            }

            for (const userId in avgResolutionTimePerUser) {
                if (avgResolutionTimePerUser[userId]) {
                    totalResolutionTime += avgResolutionTimePerUser[userId];
                    resolutionCount++;
                }
            }

            const guildAvgResponseTime = responseCount > 0 ? convertMsToSeconds(totalResponseTime / responseCount) : 'No data';
            const guildAvgResolutionTime = resolutionCount > 0 ? convertMsToSeconds(totalResolutionTime / resolutionCount) : 'No data';

            profileEmbed.addFields(
                { name: 'Guild Avg Response Time', value: `${guildAvgResponseTime} seconds`, inline: true },
                { name: 'Guild Avg Resolution Time', value: `${guildAvgResolutionTime} seconds`, inline: true }
            );

            for (const userId in profiles) {
                const profile = profiles[userId] || {};
                const bio = profile.bio || 'Not set';
                const timezone = profile.timezone || 'Not set';
                const activeHours = profile.activeHours || 'Not set';

                const avgResponseTime = avgResponseTimePerUser[userId] ? convertMsToSeconds(avgResponseTimePerUser[userId]) : 'No data';
                const avgResolutionTime = avgResolutionTimePerUser[userId] ? convertMsToSeconds(avgResolutionTimePerUser[userId]) : 'No data';

                let activeHoursFormatted = 'Not set';
                if (activeHours !== 'Not set') {
                    const [start, end] = activeHours.split('-');

                    const convertTo24Hour = (time) => {
                        const amPm = time.slice(-2).toLowerCase();
                        let [hour] = time.slice(0, -2).split(':');
                        hour = parseInt(hour);
                        if (amPm === 'pm' && hour < 12) hour += 12;
                        if (amPm === 'am' && hour === 12) hour = 0;
                        return hour;
                    };

                    try {
                        const startHour = convertTo24Hour(start);
                        const endHour = convertTo24Hour(end);

                        const activeStartUnix = Math.floor(new Date().setHours(startHour, 0, 0, 0) / 1000);
                        const activeEndUnix = Math.floor(new Date().setHours(endHour, 0, 0, 0) / 1000);

                        activeHoursFormatted = `<t:${activeStartUnix}:t> - <t:${activeEndUnix}:t>`;
                    } catch (error) {
                        console.error(`Error parsing active hours for user ${userId}: ${error}`);
                    }
                }

                try {
                    const user = await interaction.guild.members.fetch(userId);
                    const username = user.user.username;

                    profileEmbed.addFields({
                        name: `${username}`,
                        value: `**Bio:** ${bio}\n**Timezone:** ${timezone}\n**Avg Response Time:** ${avgResponseTime} seconds\n**Avg Resolution Time:** ${avgResolutionTime} seconds\n**Active Hours:** ${activeHoursFormatted}`,
                        inline: true,
                    });
                } catch (error) {
                    console.error(`Could not fetch user with ID ${userId}:`, error);
                }
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
                    embeds: [await createEmbed(initialStats.avgResolutionTimePerUser, initialStats.avgResponseTimePerUser, initialStats.totalTickets, profiles)],
                });
            }
        } catch (error) {
            client.log.error('Could not fetch existing stats message:', error);
        }

        if (!statsMessage) {
            const guildChannel = await client.channels.fetch('899659621097152563');
            statsMessage = await guildChannel.send({
                embeds: [await createEmbed(initialStats.avgResolutionTimePerUser, initialStats.avgResponseTimePerUser, initialStats.totalTickets, profiles)],
            });
        }

        const updateInterval = setInterval(async () => {
            const updatedStats = await fetchStats();
            const updatedProfiles = await fetchProfiles();
            if (updatedStats) {
                await statsMessage.edit({
                    embeds: [await createEmbed(updatedStats.avgResolutionTimePerUser, updatedStats.avgResponseTimePerUser, updatedStats.totalTickets, updatedProfiles)],
                });
            }
        }, 60000);  // 1 minute

        interaction.channel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000, errors: ['time'] })
            .then(() => clearInterval(updateInterval))
            .catch(() => clearInterval(updateInterval));
    }
};
