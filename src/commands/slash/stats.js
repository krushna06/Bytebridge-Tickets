const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
module.exports = class StatsSlashCommand extends SlashCommand {
	_isSuperUser(interaction) {
		const superUsers = process.env.SUPER?.split(',').map(id => id.trim()) || [];
		return interaction.user && superUsers.includes(interaction.user.id);
	}
	constructor(client, options) {
		const name = 'stats';
		super(client, {
			...options,
			description: 'View ticket statistics',
			dmPermission: false,
			name,
			options: [
				{
					description: 'Select a time period for statistics',
					choices: [
						{
							name: '24 Hours',
							value: '24h',
						},
						{
							name: '7 Days',
							value: '7d',
						},
						{
							name: '30 Days',
							value: '30d',
						},
						{
							name: '90 Days',
							value: '90d',
						},
					],
					name: 'timerange',
					type: ApplicationCommandOptionType.String,
					required: false,
				},
			],
		});
	}
	async run(interaction) {
		const client = this.client;
		if (!this._isSuperUser(interaction)) {
			client.log.warn(`User ${process.env.USER || 'unknown'} attempted to use stats command but is not authorized.`);
			return interaction.reply({ 
				content: '❌ Access denied. Only SUPER users can use this command.',
				ephemeral: true 
			});
		}
		await interaction.deferReply();
		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		if (!(await isStaff(interaction.guild, interaction.member.id))) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle('❌ Error')
						.setDescription('Only staff members can view ticket statistics.'),
				],
			});
		}
		const existingStats = await client.prisma.statsMessage.findFirst({ where: { guildId: interaction.guild.id } });
		const statsEmbed = await this.generateStatsEmbed(interaction, settings);
		let message;
		if (existingStats) {
			try {
				const channel = await interaction.guild.channels.fetch(existingStats.channelId);
				message = await channel.messages.fetch(existingStats.messageId);
				await message.edit({ embeds: [statsEmbed] });
				await interaction.editReply({
					content: 'Statistics are being displayed and updated in the original message.',
					ephemeral: true,
				});
			} catch (error) {
				message = await interaction.editReply({ embeds: [statsEmbed] });
			}
		} else {
			message = await interaction.editReply({ embeds: [statsEmbed] });
		}
		await client.prisma.statsMessage.upsert({
			create: {
				channelId: message.channel.id,
				guildId: interaction.guild.id,
				messageId: message.id,
			},
			update: {
				channelId: message.channel.id,
				messageId: message.id,
			},
			where: { guildId: interaction.guild.id },
		});
		if (!client.statsUpdateIntervals?.has(interaction.guild.id)) {
			const interval = setInterval(async () => {
				try {
					const updatedEmbed = await this.generateStatsEmbed(interaction, settings);
					await message.edit({ embeds: [updatedEmbed] });
				} catch (error) {
					clearInterval(interval);
					client.statsUpdateIntervals.delete(interaction.guild.id);
				}
			}, 120000);
			if (!client.statsUpdateIntervals) client.statsUpdateIntervals = new Map();
			client.statsUpdateIntervals.set(interaction.guild.id, interval);
		}
	}
	async generateStatsEmbed(interaction, settings) {
		const client = this.client;
		const timeRange = interaction.options.getString('timerange') || '7d';
		let startDate;
		const endDate = new Date();
		switch(timeRange) {
		case '24h':
			startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
			break;
		case '7d':
			startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
			break;
		case '30d':
			startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
			break;
		case '90d':
			startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
			break;
		default:
			startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
		}
		const timeRangeDisplay = {
			'7d': 'Last 7 Days',
			'24h': 'Last 24 Hours',
			'30d': 'Last 30 Days',
			'90d': 'Last 90 Days',
		}[timeRange];
		try {
			const tickets = await client.prisma.ticket.findMany({
				include: {
					category: true,
					claimedBy: true,
					feedback: true,
				},
				where: {
					createdAt: {
						gte: startDate,
						lte: endDate,
					},
					guildId: interaction.guild.id,
				},
			});
			if (tickets.length === 0) {
				return new ExtendedEmbedBuilder({ 
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.primaryColour)
					.setTitle('ℹ️ No Data')
					.setDescription('No tickets found in the selected time period.');
			}
			const categoryCount = {};
			tickets.forEach(ticket => {
				if (ticket.category) {
					const categoryName = ticket.category.name;
					categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
				}
			});
			let mostPopularCategory = {
				count: 0,
				name: 'None',
			};
			Object.entries(categoryCount).forEach(([name, count]) => {
				if (count > mostPopularCategory.count) {
					mostPopularCategory = {
						count,
						name,
					};
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
			const daysDifference = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
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
							closedTickets: 0,
							ticketsHandled: 0,
							ticketsWithResponse: 0,
							ticketsWithFeedback: 0,
							totalRating: 0,
							totalResponseTime: 0,
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
			const staffStats = Object.values(staffPerformance).map(staff => ({
				...staff,
				avgRating: staff.ticketsWithFeedback > 0
					? staff.totalRating / staff.ticketsWithFeedback
					: 0,
				avgResponseTime: staff.ticketsWithResponse > 0
					? (staff.totalResponseTime / staff.ticketsWithResponse) / (1000 * 60)
					: 0,
			})).sort((a, b) => b.ticketsHandled - a.ticketsHandled);
			const statsEmbed = new ExtendedEmbedBuilder({
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			})
				.setColor(settings.primaryColour)
				.setTitle('📊 Ticket Statistics')
				.setDescription(`Statistics for ${timeRangeDisplay}`);
			statsEmbed.addFields([
				{
					inline: true,
					name: '📊 Total Tickets',
					value: `${tickets.length} tickets`,
				},
				{
					inline: true,
					name: '🟢 Open Tickets',
					value: `${tickets.filter(t => t.open).length} tickets`,
				},
				{
					inline: true,
					name: '🔴 Closed Tickets',
					value: `${tickets.filter(t => !t.open).length} tickets`,
				},
			]);
			statsEmbed.addFields([
				{
					name: '🏆 Most Popular Category',
					inline: true,
					value: mostPopularCategory.count > 0
						? `${mostPopularCategory.name}: ${mostPopularCategory.count} tickets`
						: 'No categorized tickets',
				},
				{
					name: '⏱️ Average Response Time',
					inline: true,
					value: `${avgResponseTime.toFixed(2)} minutes`,
				},
				{
					name: '📈 Average Daily Tickets',
					inline: true,
					value: `${avgDailyTickets.toFixed(2)} tickets per day`,
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
			console.error('Error in stats command:', error);
			return new ExtendedEmbedBuilder({ 
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			})
				.setColor(settings.errorColour)
				.setTitle('❌ Error')
				.setDescription('There was an error generating ticket statistics.');
		}
	}
};
function generateStarRating(rating) {
	const fullStars = Math.floor(rating);
	const halfStar = rating - fullStars >= 0.5;
	const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
	return '★'.repeat(fullStars) + (halfStar ? '⭐' : '') + '☆'.repeat(emptyStars);
}