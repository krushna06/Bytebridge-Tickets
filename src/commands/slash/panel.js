const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');

module.exports = class PanelSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'panel';
        super(client, {
            ...options,
            description: 'View a live ticket statistics panel (super users only)',
            dmPermission: false,
            name,
        });
    }

    async run(interaction) {
        await interaction.deferReply();
        const client = this.client;
        const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

        if (!client.supers.includes(interaction.user.id)) {
            return interaction.editReply({
                embeds: [
                    new ExtendedEmbedBuilder({
                        iconURL: interaction.guild.iconURL(),
                        text: settings.footer,
                    })
                        .setColor(settings.errorColour)
                        .setTitle('❌ Access Denied')
                        .setDescription('Only super users can view the ticket panel.'),
                ],
            });
        }

        const updatePanel = async () => {
            try {
                const tickets = await client.prisma.ticket.findMany({
                    where: {
                        guildId: interaction.guild.id,
                    },
                    include: {
                        category: true,
                        claimedBy: true,
                        feedback: true,
                    },
                });

                if (tickets.length === 0) {
                    return interaction.editReply({
                        embeds: [
                            new ExtendedEmbedBuilder({
                                iconURL: interaction.guild.iconURL(),
                                text: settings.footer,
                            })
                                .setColor(settings.primaryColour)
                                .setTitle('ℹ️ No Data')
                                .setDescription('No tickets found.'),
                        ],
                    });
                }

                const categoryCount = {};
                tickets.forEach(ticket => {
                    if (ticket.category) {
                        const categoryName = ticket.category.name;
                        categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
                    }
                });
                
                let mostPopularCategory = { name: 'None', count: 0 };
                Object.entries(categoryCount).forEach(([name, count]) => {
                    if (count > mostPopularCategory.count) {
                        mostPopularCategory = { name, count };
                    }
                });

                let totalResponseTime = 0;
                let ticketsWithResponse = 0;
                
                tickets.forEach(ticket => {
                    if (ticket.firstResponseAt && ticket.createdAt) {
                        const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
                        totalResponseTime += responseTime;
                        ticketsWithResponse++;
                    }
                });
                
                const avgResponseTime = ticketsWithResponse > 0 
                    ? (totalResponseTime / ticketsWithResponse) / (1000 * 60)
                    : 0;

                const daysDifference = Math.max(1, Math.ceil((new Date() - new Date(tickets[0].createdAt)) / (1000 * 60 * 60 * 24)));
                const avgDailyTickets = tickets.length / daysDifference;

                let totalRating = 0;
                let ticketsWithFeedback = 0;
                
                tickets.forEach(ticket => {
                    if (ticket.feedback && ticket.feedback.rating) {
                        totalRating += ticket.feedback.rating;
                        ticketsWithFeedback++;
                    }
                });
                
                const avgFeedbackRating = ticketsWithFeedback > 0 
                    ? totalRating / ticketsWithFeedback
                    : 0;

                const starRating = generateStarRating(avgFeedbackRating);

                const staffPerformance = {};
                
                tickets.forEach(ticket => {
                    if (ticket.claimedById) {
                        if (!staffPerformance[ticket.claimedById]) {
                            staffPerformance[ticket.claimedById] = {
                                id: ticket.claimedById,
                                name: ticket.claimedBy?.id ? `<@${ticket.claimedBy.id}>` : `ID: ${ticket.claimedById}`,
                                ticketsHandled: 0,
                                closedTickets: 0,
                                totalResponseTime: 0,
                                ticketsWithResponse: 0,
                                totalRating: 0,
                                ticketsWithFeedback: 0
                            };
                        }
                        
                        staffPerformance[ticket.claimedById].ticketsHandled++;
                        
                        if (!ticket.open) {
                            staffPerformance[ticket.claimedById].closedTickets++;
                        }
                        
                        if (ticket.firstResponseAt && ticket.createdAt) {
                            staffPerformance[ticket.claimedById].totalResponseTime += 
                                ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
                            staffPerformance[ticket.claimedById].ticketsWithResponse++;
                        }
                        
                        if (ticket.feedback && ticket.feedback.rating) {
                            staffPerformance[ticket.claimedById].totalRating += ticket.feedback.rating;
                            staffPerformance[ticket.claimedById].ticketsWithFeedback++;
                        }
                    }
                });
                
                const staffStats = Object.values(staffPerformance).map(staff => {
                    return {
                        ...staff,
                        avgResponseTime: staff.ticketsWithResponse > 0 
                            ? (staff.totalResponseTime / staff.ticketsWithResponse) / (1000 * 60) 
                            : 0,
                        avgRating: staff.ticketsWithFeedback > 0
                            ? staff.totalRating / staff.ticketsWithFeedback
                            : 0
                    };
                }).sort((a, b) => b.ticketsHandled - a.ticketsHandled);
                
                const statsEmbed = new ExtendedEmbedBuilder({
                    iconURL: interaction.guild.iconURL(),
                    text: settings.footer,
                })
                    .setColor(settings.primaryColour)
                    .setTitle('📊 Live Ticket Statistics')
                    .setDescription('Statistics for all time');
                
                statsEmbed.addFields([
                    {
                        name: '📊 Total Tickets',
                        value: `${tickets.length} tickets`,
                        inline: true,
                    },
                    {
                        name: '🟢 Open Tickets',
                        value: `${tickets.filter(t => t.open).length} tickets`,
                        inline: true,
                    },
                    {
                        name: '🔴 Closed Tickets',
                        value: `${tickets.filter(t => !t.open).length} tickets`,
                        inline: true,
                    },
                ]);
                
                statsEmbed.addFields([
                    {
                        name: '🏆 Most Popular Category',
                        value: mostPopularCategory.count > 0 
                            ? `${mostPopularCategory.name}: ${mostPopularCategory.count} tickets` 
                            : 'No categorized tickets',
                        inline: true,
                    },
                    {
                        name: '⏱️ Average Response Time',
                        value: `${avgResponseTime.toFixed(2)} minutes`,
                        inline: true,
                    },
                    {
                        name: '📈 Average Daily Tickets',
                        value: `${avgDailyTickets.toFixed(2)} tickets per day`,
                        inline: true,
                    },
                ]);
                
                statsEmbed.addFields({
                    name: '⭐ Average Feedback Rating',
                    value: ticketsWithFeedback > 0
                        ? `${starRating} (${avgFeedbackRating.toFixed(2)}/5 from ${ticketsWithFeedback} ratings)`
                        : 'No feedback ratings yet',
                });
                
                if (staffStats.length > 0) {
                    const staffField = {
                        name: '👥 Staff Performance',
                        value: staffStats.slice(0, 5).map((staff, index) => {
                            let staffLine = `${index + 1}. ${staff.name}: ${staff.ticketsHandled} tickets (${staff.avgResponseTime.toFixed(2)} min avg)`;
                            
                            if (staff.ticketsWithFeedback > 0) {
                                const staffStars = generateStarRating(staff.avgRating);
                                staffLine += ` ${staffStars}`;
                            }
                            
                            return staffLine;
                        }).join('\n'),
                    };
                    
                    statsEmbed.addFields(staffField);
                }

                return statsEmbed;
            } catch (error) {
                console.error('Error updating panel:', error);
                return null;
            }
        };

        const statsEmbed = await updatePanel();
        if (!statsEmbed) {
            return interaction.editReply({
                embeds: [
                    new ExtendedEmbedBuilder({
                        iconURL: interaction.guild.iconURL(),
                        text: settings.footer,
                    })
                        .setColor(settings.errorColour)
                        .setTitle('❌ Error')
                        .setDescription('Failed to fetch ticket statistics.'),
                ],
            });
        }

        const message = await interaction.editReply({ embeds: [statsEmbed] });

        await client.prisma.panel.upsert({
            where: {
                guildId: interaction.guild.id,
            },
            update: {
                channelId: interaction.channel.id,
                messageId: message.id,
                updatedAt: new Date(),
            },
            create: {
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                messageId: message.id,
            },
        });

        const interval = setInterval(async () => {
            const newEmbed = await updatePanel();
            if (newEmbed) {
                try {
                    await message.edit({ embeds: [newEmbed] });
                } catch (error) {
                    console.error('Error editing panel message:', error);
                    clearInterval(interval);
                    await client.prisma.panel.delete({
                        where: {
                            guildId: interaction.guild.id,
                        },
                    }).catch(() => null);
                }
            }
        }, 120000);

        if (!client.panelIntervals) {
            client.panelIntervals = new Map();
        }
        client.panelIntervals.set(interaction.guild.id, interval);
    }
};

function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + (halfStar ? '⭐' : '') + '☆'.repeat(emptyStars);
} 