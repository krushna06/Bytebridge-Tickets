const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

module.exports = class ViewProfileSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'viewprofile';
        super(client, {
            ...options,
            description: 'View a staff member\'s profile',
            dmPermission: false,
            name,
            options: [
                {
                    name: 'member',
                    description: 'The staff member whose profile you want to view',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        });
    }

    async run(interaction) {
        await interaction.deferReply();

        const settings = await this.client.prisma.guild.findUnique({ 
            where: { id: interaction.guild.id } 
        });

        const targetMember = interaction.options.getMember('member');

        if (!(await isStaff(interaction.guild, targetMember.id))) {
            return await interaction.editReply({
                embeds: [
                    new ExtendedEmbedBuilder({
                        iconURL: interaction.guild.iconURL(),
                        text: settings.footer,
                    })
                        .setColor(settings.errorColour)
                        .setTitle('❌ Error')
                        .setDescription('This user is not a staff member.'),
                ],
            });
        }

        const userProfile = await this.client.prisma.user.findUnique({
            where: { id: targetMember.id }
        });

        const embed = new ExtendedEmbedBuilder({
            iconURL: interaction.guild.iconURL(),
            text: settings.footer,
        })
            .setColor(settings.primaryColour)
            .setTitle(`${targetMember.displayName}'s Profile`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }));

        if (userProfile?.bio) {
            embed.addFields({ name: 'Staff Bio', value: userProfile.bio });
        }

        if (userProfile?.activeHours && userProfile.activeHours !== '[]') {
            const hours = JSON.parse(userProfile.activeHours);
            embed.addFields({ 
                name: 'Active Hours', 
                value: hours.join('\n') || 'Not set'
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [ticketsClaimed, ticketsClosed, averageRating, averageResponse] = await Promise.all([
            this.client.prisma.ticket.count({
                where: {
                    claimedById: targetMember.id,
                    createdAt: { gte: thirtyDaysAgo }
                }
            }),
            this.client.prisma.ticket.count({
                where: {
                    closedById: targetMember.id,
                    closedAt: { gte: thirtyDaysAgo }
                }
            }),
            this.client.prisma.ticket.findMany({
                where: {
                    closedById: targetMember.id,
                    feedback: { isNot: null },
                    closedAt: { gte: thirtyDaysAgo }
                },
                include: { feedback: true }
            }).then(tickets => {
                if (tickets.length === 0) return null;
                const total = tickets.reduce((sum, ticket) => sum + ticket.feedback.rating, 0);
                return (total / tickets.length).toFixed(1);
            }),
            this.client.prisma.ticket.findMany({
                where: {
                    claimedById: targetMember.id,
                    firstResponseAt: { not: null },
                    createdAt: { gte: thirtyDaysAgo }
                },
                select: {
                    createdAt: true,
                    firstResponseAt: true
                }
            }).then(tickets => {
                if (tickets.length === 0) return null;
                const total = tickets.reduce((sum, ticket) => 
                    sum + (new Date(ticket.firstResponseAt) - new Date(ticket.createdAt)), 0);
                return Math.round(total / tickets.length / 1000 / 60); // Convert to minutes
            })
        ]);

        embed.addFields(
            { name: 'Tickets Claimed (30d)', value: ticketsClaimed.toString(), inline: true },
            { name: 'Tickets Closed (30d)', value: ticketsClosed.toString(), inline: true },
            { name: 'Average Rating (30d)', value: averageRating ? `${averageRating} ⭐` : 'No ratings', inline: true },
            { name: 'Avg Response Time (30d)', value: averageResponse ? `${averageResponse} min` : 'No data', inline: true }
        );

        await interaction.editReply({ embeds: [embed] });
    }
};