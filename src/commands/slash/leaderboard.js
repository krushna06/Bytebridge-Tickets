const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
// Add StringSelectMenuBuilder to the imports
const {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');

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
						{
							name: 'Staff Ratings',
							value: 'rating',
						},
						{
							name: 'Tickets Claimed',
							value: 'claimed',
						},
						{
							name: 'Tickets Resolved',
							value: 'resolved',
						},
						{
							name: 'Average Response Time',
							value: 'response',
						},
					],
					description: 'Type of leaderboard to view',
					name: 'type',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
			],
		});
	}

	async run(interaction, options = {}) {
		if (!options.type && !options.isUpdate) {
			await interaction.deferReply();
		}

		const settings = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

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

		// Helper to get staff role IDs
		const getStaffRoleIds = async () => {
			const { categories } = await this.client.prisma.guild.findUnique({
				select: { categories: { select: { staffRoles: true } } },
				where: { id: interaction.guild.id },
			});
			return [
				...new Set(
					categories.reduce((acc, c) => {
						acc.push(...c.staffRoles);
						return acc;
					}, []),
				),
			];
		};

		const getStaffMembers = async staffRoleIds => {
			const supers = this.client.supers || [];
			return interaction.guild.members.cache.filter(member => {
				if (supers.includes(member.id)) return true;
				if (member.permissions.has('ManageGuild')) return true;
				return member.roles.cache.some(role => staffRoleIds.includes(role.id));
			});
		};

		const pageSize = 5;

		// Fetch leaderboard data for a given type
		const fetchLeaderboardData = async (type, staffIds, timeRange) => {
			let title, description, data;
			switch (type) {
				case 'rating': {
					const ratings = await this.client.prisma.ticket.findMany({
						include: { closedBy: true, feedback: true },
						where: {
							closedAt: { gte: timeRange },
							feedback: { isNot: null },
							guildId: interaction.guild.id,
						},
					});
					const staffRatings = {};
					ratings.forEach(ticket => {
						if (!ticket.closedBy) return;
						if (!staffIds.has(ticket.closedBy.id)) return;
						if (!staffRatings[ticket.closedBy.id]) {
							staffRatings[ticket.closedBy.id] = { count: 0, ratings: [], total: 0 };
						}
						staffRatings[ticket.closedBy.id].ratings.push(ticket.feedback.rating);
						staffRatings[ticket.closedBy.id].total += ticket.feedback.rating;
						staffRatings[ticket.closedBy.id].count++;
					});
					data = Object.entries(staffRatings)
						.map(([id, stats]) => ({ average: stats.total / stats.count, count: stats.count, id }))
						.sort((a, b) => b.average - a.average)
						.slice(0, 10);
					title = '⭐ Staff Rating Leaderboard';
					description = 'Top 10 staff members by average rating (last 30 days)';
					break;
				}
				case 'claimed': {
					const claimed = await this.client.prisma.ticket.groupBy({
						_count: true,
						by: ['claimedById'],
						where: {
							claimedById: { not: null },
							createdAt: { gte: timeRange },
							guildId: interaction.guild.id,
						},
					});
					data = claimed
						.map(entry => ({ count: entry._count, id: entry.claimedById }))
						.sort((a, b) => b.count - a.count)
						.slice(0, 10);
					title = '🎫 Tickets Claimed Leaderboard';
					description = 'Top 10 staff members by tickets claimed (last 30 days)';
					break;
				}
				case 'resolved': {
					const resolved = await this.client.prisma.ticket.groupBy({
						_count: true,
						by: ['closedById'],
						where: {
							closedAt: { gte: timeRange },
							closedById: { not: null },
							guildId: interaction.guild.id,
						},
					});
					data = resolved
						.map(entry => ({ count: entry._count, id: entry.closedById }))
						.sort((a, b) => b.count - a.count)
						.slice(0, 10);
					title = '✅ Tickets Resolved Leaderboard';
					description = 'Top 10 staff members by tickets resolved (last 30 days)';
					break;
				}
				case 'response': {
					const tickets = await this.client.prisma.ticket.findMany({
						select: { claimedById: true, createdAt: true, firstResponseAt: true },
						where: {
							createdAt: { gte: timeRange },
							firstResponseAt: { not: null },
							guildId: interaction.guild.id,
						},
					});
					const responseTimes = {};
					tickets.forEach(ticket => {
						if (!ticket.claimedById) return;
						if (!responseTimes[ticket.claimedById]) {
							responseTimes[ticket.claimedById] = { count: 0, total: 0 };
						}
						responseTimes[ticket.claimedById].total += ticket.firstResponseAt - ticket.createdAt;
						responseTimes[ticket.claimedById].count++;
					});
					data = Object.entries(responseTimes)
						.map(([id, stats]) => ({ average: stats.total / stats.count, count: stats.count, id }))
						.sort((a, b) => a.average - b.average)
						.slice(0, 10);
					title = '⚡ Response Time Leaderboard';
					description = 'Top 10 staff members by average response time (last 30 days)';
					break;
				}
			}
			return { title, description, data };
		};

		// Generate embed for a given page/type
		const generateEmbed = async (type, page, settings, data, title, description, totalPages) => {
			const startIndex = page * pageSize;
			const pageEntries = data.slice(startIndex, startIndex + pageSize);
			const embed = new ExtendedEmbedBuilder({
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			})
				.setColor(settings.primaryColour)
				.setTitle(title)
				.setDescription(`${description}\nPage ${page + 1}/${totalPages}`);
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
			embed.addFields({
				name: 'Rankings',
				value: entries.join('\n') || 'No data available',
			});
			return embed;
		};

		const generateComponents = (type, page, totalPages) => {
			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId(JSON.stringify({ action: 'leaderboard', type, page }))
				.setPlaceholder('Select leaderboard type')
				.addOptions([
					{ emoji: '⭐', default: type === 'rating', label: 'Staff Ratings', value: 'rating' },
					{ emoji: '🎫', default: type === 'claimed', label: 'Tickets Claimed', value: 'claimed' },
					{ emoji: '✅', default: type === 'resolved', label: 'Tickets Resolved', value: 'resolved' },
					{ emoji: '⚡', default: type === 'response', label: 'Average Response Time', value: 'response' },
				]);
			const buttons = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(JSON.stringify({ action: 'leaderboard_prev', type, page }))
					.setLabel('Previous')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(JSON.stringify({ action: 'leaderboard_next', type, page }))
					.setLabel('Next')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= totalPages - 1),
			);
			return [new ActionRowBuilder().addComponents(selectMenu), buttons];
		};

		// Initial state
		let type = options.type || interaction.options?.getString('type') || 'rating';
		let page = 0;
		const timeRange = new Date();
		timeRange.setDate(timeRange.getDate() - 30);
		const staffRoleIds = await getStaffRoleIds();
		const staffMembers = await getStaffMembers(staffRoleIds);
		const staffIds = new Set(staffMembers.map(m => m.id));
		let { title, description, data } = await fetchLeaderboardData(type, staffIds, timeRange);
		let totalPages = Math.ceil(data.length / pageSize) || 1;

		const replyMethod = options.isUpdate ? interaction.update.bind(interaction) : interaction.editReply.bind(interaction);
		const response = await replyMethod({
			components: generateComponents(type, page, totalPages),
			embeds: [await generateEmbed(type, page, settings, data, title, description, totalPages)],
		});

		const collector = response.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 300000,
		});

		collector.on('collect', async i => {
			let parsed;
			try {
				parsed = JSON.parse(i.customId);
			} catch (e) {
				return i.reply({ content: 'Invalid interaction.', ephemeral: true });
			}
			let { action } = parsed;
			type = parsed.type;
			page = parseInt(parsed.page, 10);
			if (action === 'leaderboard_prev') {
				page--;
			} else if (action === 'leaderboard_next') {
				page++;
			} else if (action === 'leaderboard') {
				type = i.values[0];
				page = 0;
			}
			// Refetch data for the new type
			({ title, description, data } = await fetchLeaderboardData(type, staffIds, timeRange));
			totalPages = Math.ceil(data.length / pageSize) || 1;
			if (page < 0) page = 0;
			if (page >= totalPages) page = totalPages - 1;
			await i.update({
				components: generateComponents(type, page, totalPages),
				embeds: [await generateEmbed(type, page, settings, data, title, description, totalPages)],
			});
		});

		collector.on('end', async () => {
			// Remove all components when collector expires
			await response.edit({
				components: [],
				embeds: [await generateEmbed(type, page, settings, data, title, description, totalPages)],
			}).catch(() => {});
		});
	}
};