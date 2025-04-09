const { SlashCommand } = require('@eartharoid/dbf');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { getAverageTimes } = require('../../lib/stats');
const ms = require('ms');

module.exports = class StatsSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'stats';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import("client")} */
		const client = this.client;
		const getMessage = client.i18n.getLocale(interaction.guild.preferredLocale);

		const tickets = await client.prisma.ticket.findMany({
			where: { guildId: interaction.guildId },
			include: {
				feedback: true,
				closedBy: true,
			},
		});

		const totalTickets = tickets.length;
		const openTickets = tickets.filter(t => t.open).length;
		const closedTickets = totalTickets - openTickets;

		const closedTicketsWithResponse = tickets.filter(t => t.firstResponseAt && t.closedAt);
		const { avgResponseTime } = await getAverageTimes(closedTicketsWithResponse);

		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const ticketsLast30Days = tickets.filter(t => t.createdAt >= thirtyDaysAgo).length;
		const avgDailyTickets = (ticketsLast30Days / 30).toFixed(1);

		const ticketsWithFeedback = tickets.filter(t => t.feedback);
		const totalRating = ticketsWithFeedback.reduce((sum, t) => sum + t.feedback.rating, 0);
		const avgRating = ticketsWithFeedback.length > 0 
			? (totalRating / ticketsWithFeedback.length).toFixed(1)
			: 'N/A';

		const staffStats = new Map();
		for (const ticket of closedTicketsWithResponse) {
			if (!ticket.closedBy) continue;
			
			const responseTime = ticket.firstResponseAt - ticket.createdAt;
			const staffId = ticket.closedBy.id;
			
			if (!staffStats.has(staffId)) {
				staffStats.set(staffId, {
					name: ticket.closedBy.username,
					totalTime: 0,
					count: 0,
				});
			}
			
			const stats = staffStats.get(staffId);
			stats.totalTime += responseTime;
			stats.count++;
		}

		const staffPerformance = Array.from(staffStats.entries())
			.map(([_, stats]) => ({
				name: stats.name,
				avgTime: stats.totalTime / stats.count,
			}))
			.sort((a, b) => a.avgTime - b.avgTime)
			.slice(0, 5);

		const embed = new ExtendedEmbedBuilder()
			.setColor(interaction.guild.members.me.displayHexColor)
			.setTitle(getMessage('commands.slash.stats.response.title'))
			.setDescription(getMessage('commands.slash.stats.response.description', { guild: interaction.guild.name }))
			.addFields(
				{ name: getMessage('commands.slash.stats.response.fields.total'), value: totalTickets.toString(), inline: true },
				{ name: getMessage('commands.slash.stats.response.fields.open'), value: openTickets.toString(), inline: true },
				{ name: getMessage('commands.slash.stats.response.fields.closed'), value: closedTickets.toString(), inline: true },
				{ name: getMessage('commands.slash.stats.response.fields.avg_response'), value: ms(avgResponseTime, { long: true }), inline: true },
				{ name: getMessage('commands.slash.stats.response.fields.avg_daily'), value: avgDailyTickets, inline: true },
				{ name: getMessage('commands.slash.stats.response.fields.feedback'), value: avgRating, inline: true },
			);

		if (staffPerformance.length > 0) {
			const staffField = staffPerformance
				.map((staff, index) => `${index + 1}. ${staff.name}: ${ms(staff.avgTime, { long: true })}`)
				.join('\n');
			embed.addFields({ name: getMessage('commands.slash.stats.response.fields.staff'), value: staffField });
		}

		await interaction.reply({ embeds: [embed] });
	}
}; 