const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
// Add StringSelectMenuBuilder to the imports
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = class LeaderboardSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'leaderboard';
		super(client, {
			...options,
			description: 'View staff leaderboard statistics',
			dmPermission: false,
			name,
			options: [
				{
					choices: [
						{ name: 'Staff Ratings', value: 'rating' },
						{ name: 'Tickets Claimed', value: 'claimed' },
						{ name: 'Tickets Resolved', value: 'resolved' },
						{ name: 'Average Response Time', value: 'response' }
					],
					name: 'type',
					type: ApplicationCommandOptionType.String,
					description: 'Type of leaderboard to view',
					required: false
				}
			]
		});
	}

	async run(interaction, options = {}) {
		// Only defer if it's a new slash command interaction
		if (!options.type) {
			await interaction.deferReply();
		}
		
		const settings = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

		// Check if user is staff
		if (!(await isStaff(interaction.guild, interaction.user.id))) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle('❌ Error')
						.setDescription('Only staff members can view the leaderboard.'),
				],
			});
		}

		// Change const to let since we'll modify it
		// Modified type retrieval to work with both slash commands and menu interactions
		let type = options.type || interaction.options?.getString('type') || 'rating';
		
		const timeRange = new Date();
		timeRange.setDate(timeRange.getDate() - 30); // Last 30 days

		let title, description, data;

		switch (type) {
			case 'rating': {
				const ratings = await this.client.prisma.ticket.findMany({
					where: {
						guildId: interaction.guild.id,
						feedback: { isNot: null },
						closedAt: { gte: timeRange }
					},
					include: {
						closedBy: true,
						feedback: true
					}
				});

				const staffRatings = {};
				ratings.forEach(ticket => {
					if (!ticket.closedBy) return;
					if (!staffRatings[ticket.closedBy.id]) {
						staffRatings[ticket.closedBy.id] = {
							ratings: [],
							total: 0,
							count: 0
						};
					}
					staffRatings[ticket.closedBy.id].ratings.push(ticket.feedback.rating);
					staffRatings[ticket.closedBy.id].total += ticket.feedback.rating;
					staffRatings[ticket.closedBy.id].count++;
				});

				data = Object.entries(staffRatings)
					.map(([id, stats]) => ({
						id,
						average: stats.total / stats.count,
						count: stats.count
					}))
					.sort((a, b) => b.average - a.average)
					.slice(0, 10);

				title = '⭐ Staff Rating Leaderboard';
				description = 'Top 10 staff members by average rating (last 30 days)';
				break;
			}

			case 'claimed': {
				const claimed = await this.client.prisma.ticket.groupBy({
					by: ['claimedById'],
					where: {
						guildId: interaction.guild.id,
						claimedById: { not: null },
						createdAt: { gte: timeRange }
					},
					_count: true
				});

				data = claimed
					.map(entry => ({
						id: entry.claimedById,
						count: entry._count
					}))
					.sort((a, b) => b.count - a.count)
					.slice(0, 10);

				title = '🎫 Tickets Claimed Leaderboard';
				description = 'Top 10 staff members by tickets claimed (last 30 days)';
				break;
			}

			case 'resolved': {
				const resolved = await this.client.prisma.ticket.groupBy({
					by: ['closedById'],
					where: {
						guildId: interaction.guild.id,
						closedById: { not: null },
						closedAt: { gte: timeRange }
					},
					_count: true
				});

				data = resolved
					.map(entry => ({
						id: entry.closedById,
						count: entry._count
					}))
					.sort((a, b) => b.count - a.count)
					.slice(0, 10);

				title = '✅ Tickets Resolved Leaderboard';
				description = 'Top 10 staff members by tickets resolved (last 30 days)';
				break;
			}

			case 'response': {
				const tickets = await this.client.prisma.ticket.findMany({
					where: {
						guildId: interaction.guild.id,
						firstResponseAt: { not: null },
						createdAt: { gte: timeRange }
					},
					select: {
						createdAt: true,
						firstResponseAt: true,
						claimedById: true
					}
				});

				const responseTimes = {};
				tickets.forEach(ticket => {
					if (!ticket.claimedById) return;
					if (!responseTimes[ticket.claimedById]) {
						responseTimes[ticket.claimedById] = {
							total: 0,
							count: 0
						};
					}
					responseTimes[ticket.claimedById].total += ticket.firstResponseAt - ticket.createdAt;
					responseTimes[ticket.claimedById].count++;
				});

				data = Object.entries(responseTimes)
					.map(([id, stats]) => ({
						id,
						average: stats.total / stats.count,
						count: stats.count
					}))
					.sort((a, b) => a.average - b.average) // Faster response time is better
					.slice(0, 10);

				title = '⚡ Response Time Leaderboard';
				description = 'Top 10 staff members by average response time (last 30 days)';
				break;
			}
		}

		const embed = new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(settings.primaryColour)
			.setTitle(title)
			.setDescription(description);

		// Format the leaderboard entries
		const entries = await Promise.all(data.map(async (entry, index) => {
			const member = await interaction.guild.members.fetch(entry.id).catch(() => null);
			const name = member ? member.displayName : 'Unknown Staff';
			
			let value;
			switch (type) {
				case 'rating':
					value = `${entry.average.toFixed(1)} ⭐ (${entry.count} ratings)`;
					break;
				case 'claimed':
				case 'resolved':
					value = `${entry.count} tickets`;
					break;
				case 'response':
					value = `${Math.round(entry.average / 1000 / 60)} minutes avg.`;
					break;
			}

			return `${index + 1}. ${name}: ${value}`;
		}));

		embed.addFields({ name: 'Rankings', value: entries.join('\n') || 'No data available' });

		await interaction.editReply({ embeds: [embed] });

		// After preparing data in switch cases, add this:
		const pageSize = 5;
		let currentPage = 0;
		const totalPages = Math.ceil(data.length / pageSize);

		const generateEmbed = async (page) => {
			const startIndex = page * pageSize;
			const pageEntries = data.slice(startIndex, startIndex + pageSize);

			const embed = new ExtendedEmbedBuilder({
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			})
				.setColor(settings.primaryColour)
				.setTitle(title)
				.setDescription(`${description}\nPage ${page + 1}/${totalPages}`);

			// Format the leaderboard entries for current page
			const entries = await Promise.all(pageEntries.map(async (entry, index) => {
				const member = await interaction.guild.members.fetch(entry.id).catch(() => null);
				const name = member ? member.displayName : 'Unknown Staff';
				
				let value;
				switch (type) {
					case 'rating':
						value = `${entry.average.toFixed(1)} ⭐ (${entry.count} ratings)`;
						break;
					case 'claimed':
					case 'resolved':
						value = `${entry.count} tickets`;
						break;
					case 'response':
						value = `${Math.round(entry.average / 1000 / 60)} minutes avg.`;
						break;
				}

				return `${startIndex + index + 1}. ${name}: ${value}`;
			}));

			embed.addFields({ name: 'Rankings', value: entries.join('\n') || 'No data available' });
			return embed;
		};

		const generateComponents = (page) => {
			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId(JSON.stringify({
					action: 'leaderboard',
				}))
				.setPlaceholder('Select leaderboard type')
				.addOptions([
					{ label: 'Staff Ratings', value: 'rating', emoji: '⭐', default: type === 'rating' },
					{ label: 'Tickets Claimed', value: 'claimed', emoji: '🎫', default: type === 'claimed' },
					{ label: 'Tickets Resolved', value: 'resolved', emoji: '✅', default: type === 'resolved' },
					{ label: 'Average Response Time', value: 'response', emoji: '⚡', default: type === 'response' }
				]);

			const buttons = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('prev_page')
					.setLabel('Previous')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId('next_page')
					.setLabel('Next')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= totalPages - 1)
			);

			return [new ActionRowBuilder().addComponents(selectMenu), buttons];
		};

		// Replace the response section with this:
		const response = await interaction.editReply({
			embeds: [await generateEmbed(currentPage)],
			components: generateComponents(currentPage)
		});

		// Update the collector section:
		const collector = response.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 300000 // 5 minutes timeout
		});

		collector.on('collect', async i => {
			if (i.customId === 'prev_page') {
				currentPage--;
				await i.update({
					embeds: [await generateEmbed(currentPage)],
					components: generateComponents(currentPage)
				});
			} else if (i.customId === 'next_page') {
				currentPage++;
				await i.update({
					embeds: [await generateEmbed(currentPage)],
					components: generateComponents(currentPage)
				});
			}
		});

		collector.on('end', () => {
			// Remove all components when collector expires
			interaction.editReply({
				embeds: [initialEmbed],
				components: []
			}).catch(() => {});
		});
	}
};