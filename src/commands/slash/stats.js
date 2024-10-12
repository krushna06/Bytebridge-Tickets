const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const {
	getAvgResolutionTime, getAvgResponseTime,
} = require('../../lib/stats');

module.exports = class StatsSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'stats';
		super(client, {
			...options,
			description: 'Shows the guild stats.',
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

		await interaction.reply({
			content: 'Fetching stats...',
			ephemeral: false,
		});

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
				const totalOpenedTickets = guild.tickets.length;
				const currentOpen = guild.tickets.filter(t => !t.closedAt).length;
				const totalClaimed = guild.tickets.filter(t => t.claimedAt).length;

				return {
					avgResolutionTime,
					avgResponseTime,
					totalTickets,
					totalOpenedTickets,
					currentOpen,
					totalClaimed,
				};
			} catch (error) {
				client.log.error('Error fetching stats:', error);
				return null;
			}
		};

		const fetchFeedbackCounts = async () => {
			try {
				const feedbackCounts = await client.prisma.feedback.groupBy({
					by: ['rating'],
					where: { guildId: TARGET_GUILD_ID },
					_count: { rating: true },
				});

				const counts = {};
				for (const feedback of feedbackCounts) {
					counts[feedback.rating] = feedback._count.rating;
				}

				for (let i = 1; i <= 5; i++) {
					if (!counts[i]) {
						counts[i] = 0;
					}
				}

				return counts;
			} catch (error) {
				client.log.error('Error fetching feedback counts:', error);
				return null;
			}
		};

		const convertMsToSeconds = ms => (ms / 1000).toFixed(2);

		const createEmbed = (avgResolutionTime, avgResponseTime, totalTickets, totalOpenedTickets, currentOpen, totalClaimed, feedbackCounts) => {
			const feedbackList = [
				`1-Star Feedback: ${feedbackCounts[1]}`,
				`2-Star Feedback: ${feedbackCounts[2]}`,
				`3-Star Feedback: ${feedbackCounts[3]}`,
				`4-Star Feedback: ${feedbackCounts[4]}`,
				`5-Star Feedback: ${feedbackCounts[5]}`,
			].join('\n');

			return new EmbedBuilder()
				.setTitle('Ticket and Feedback Statistics')
				.setColor(0x00AE86)
				.addFields(
					{
						name: 'Average Resolution Time',
						value: `${convertMsToSeconds(avgResolutionTime)} seconds`,
						inline: true,
					},
					{
						name: 'Average Response Time',
						value: `${convertMsToSeconds(avgResponseTime)} seconds`,
						inline: true,
					},
					{
						name: 'Closed Tickets',
						value: `${totalTickets}`,
						inline: true,
					},
					{
						name: 'Total Tickets Opened',
						value: `${totalOpenedTickets}`,
						inline: true,
					},
					{
						name: 'Current Open',
						value: `${currentOpen}`,
						inline: true,
					},
					{
						name: 'Total Tickets Claimed',
						value: `${totalClaimed}`,
						inline: true,
					},
					{
						name: '\u200B',
						value: '\u200B',
						inline: false,
					},
					{
						name: 'Feedback Statistics',
						value: feedbackList,
						inline: false,
					},
				)
				.setTimestamp();
		};

		const initialStats = await fetchStats();
		if (!initialStats) {
			await interaction.editReply('An error occurred while fetching stats. Please try again later.');
			return;
		}

		const feedbackCounts = await fetchFeedbackCounts();
		if (feedbackCounts === null) {
			await interaction.editReply('An error occurred while fetching feedback stats. Please try again later.');
			return;
		}

		let statsMessage;
		try {
			const guildChannel = await client.channels.fetch('1292032641125843005');
			statsMessage = await guildChannel.messages.fetch({ limit: 10 }).then(messages =>
				messages.find(msg => msg.embeds.length > 0 && msg.embeds[0].title === 'Ticket and Feedback Statistics'),
			);
			if (statsMessage) {
				await statsMessage.edit({ embeds: [createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets, initialStats.totalOpenedTickets, initialStats.currentOpen, initialStats.totalClaimed, feedbackCounts)] });
			}
		} catch (error) {
			client.log.error('Could not fetch existing stats message:', error);
		}

		if (!statsMessage) {
			const guildChannel = await client.channels.fetch('1292032641125843005');
			statsMessage = await guildChannel.send({ embeds: [createEmbed(initialStats.avgResolutionTime, initialStats.avgResponseTime, initialStats.totalTickets, initialStats.totalOpenedTickets, initialStats.currentOpen, initialStats.totalClaimed, feedbackCounts)] });
		}

		const updateInterval = setInterval(async () => {
			const updatedStats = await fetchStats();
			if (updatedStats) {
				const updatedFeedbackCounts = await fetchFeedbackCounts();
				await statsMessage.edit({ embeds: [createEmbed(updatedStats.avgResolutionTime, updatedStats.avgResponseTime, updatedStats.totalTickets, updatedStats.totalOpenedTickets, updatedStats.currentOpen, updatedStats.totalClaimed, updatedFeedbackCounts)] });
			}
		}, 60000);

		interaction.channel.awaitMessages({
			filter: m => m.author.id === interaction.user.id,
			max: 1,
			time: 60000,
			errors: ['time'],
		})
			.then(() => clearInterval(updateInterval))
			.catch(() => clearInterval(updateInterval));
	}
};
