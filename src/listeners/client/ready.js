const { Listener } = require('@eartharoid/dbf');
const ms = require('ms');
const sync = require('../../lib/sync');
const checkForUpdates = require('../../lib/updates');
const { isStaff } = require('../../lib/users');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const {
	getAverageTimes,
	sendToHouston,
} = require('../../lib/stats');

function generateStarRating(rating) {
	const fullStars = Math.floor(rating);
	const halfStar = rating - fullStars >= 0.5;
	const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
	
	return '★'.repeat(fullStars) + (halfStar ? '⭐' : '') + '☆'.repeat(emptyStars);
}

module.exports = class extends Listener {
	constructor(client, options) {
		super(client, {
			...options,
			emitter: client,
			event: 'ready',
			once: true,
		});
	}

	async run() {
		/** @type {import("client")} */
		const client = this.client;

		// process.title = `"[Discord Tickets] ${client.user.tag}"`; // too long and gets cut off
		process.title = 'tickets';
		client.log.success('Connected to Discord as "%s" over %d shards', client.user.tag, client.ws.shards.size);

		await client.initAfterLogin();

		await sync(client);

		if (process.env.PUBLISH_COMMANDS === 'true') {
			client.log.info('Automatically publishing commands...');
			client.commands.publish()
				.then(commands => client.log.success('Published %d commands', commands?.size))
				.catch(client.log.error);
		}

		await client.application.fetch();
		if (process.env.PUBLIC_BOT === 'true' && !client.application.botPublic) {
			client.log.warn('The `PUBLIC_BOT` environment variable is set to `true`, but the bot is not public.');
		} else if (process.env.PUBLIC_BOT !== 'true' && client.application.botPublic) {
			client.log.warn('Your bot is public, but public features are disabled. Set the `PUBLIC_BOT` environment variable to `true`, or make your bot private.');
		}

		await client.application.commands.fetch();

		if (!client.panelIntervals) {
			client.panelIntervals = new Map();
		}

		const panels = await client.prisma.panel.findMany();
		for (const panel of panels) {
			try {
				const guild = client.guilds.cache.get(panel.guildId);
				if (!guild) continue;

				const channel = guild.channels.cache.get(panel.channelId);
				if (!channel) continue;

				const message = await channel.messages.fetch(panel.messageId).catch(() => null);
				if (!message) {
					await client.prisma.panel.delete({
						where: {
							guildId: panel.guildId,
						},
					});
					continue;
				}

				const updatePanel = async () => {
					try {
						const tickets = await client.prisma.ticket.findMany({
							where: {
								guildId: guild.id,
							},
							include: {
								category: true,
								claimedBy: true,
								feedback: true,
							},
						});

						if (tickets.length === 0) {
							await message.edit({
								embeds: [
									new ExtendedEmbedBuilder({
										iconURL: guild.iconURL(),
										text: (await client.prisma.guild.findUnique({ where: { id: guild.id } })).footer,
									})
										.setColor((await client.prisma.guild.findUnique({ where: { id: guild.id } })).primaryColour)
										.setTitle('ℹ️ No Data')
										.setDescription('No tickets found.'),
								],
							});
							return;
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
						
						const settings = await client.prisma.guild.findUnique({ where: { id: guild.id } });
						const statsEmbed = new ExtendedEmbedBuilder({
							iconURL: guild.iconURL(),
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

						await message.edit({ embeds: [statsEmbed] });
					} catch (error) {
						console.error('Error updating panel:', error);
					}
				};

				await updatePanel();
				const interval = setInterval(updatePanel, 120000);
				client.panelIntervals.set(guild.id, interval);
			} catch (error) {
				console.error('Error resuming panel update:', error);
			}
		}

		// presence/activity
		if (client.config.presence.activities?.length > 0) {
			let next = 0;
			const setPresence = async () => {
				const cacheKey = 'cache/presence';
				let cached = await client.keyv.get(cacheKey);
				if (!cached) {
					const tickets = await client.prisma.ticket.findMany({
						select: {
							closedAt: true,
							createdAt: true,
							firstResponseAt: true,
						},
					});
					const closedTickets = tickets.filter(t => t.closedAt);
					const closedTicketsWithResponse = closedTickets.filter(t => t.firstResponseAt);
					const {
						avgResolutionTime,
						avgResponseTime,
					} = await getAverageTimes(closedTicketsWithResponse);
					cached = {
						avgResolutionTime: ms(avgResolutionTime),
						avgResponseTime: ms(avgResponseTime),
						guilds: client.guilds.cache.size,
						openTickets: tickets.length - closedTickets.length,
						totalTickets: tickets.length,
					};
					await client.keyv.set(cacheKey, cached, ms('15m'));
				}
				const activity = { ...client.config.presence.activities[next] };
				activity.name = activity.name
					.replace(/{+avgResolutionTime}+/gi, cached.avgResolutionTime)
					.replace(/{+avgResponseTime}+/gi, cached.avgResponseTime)
					.replace(/{+guilds}+/gi, cached.guilds)
					.replace(/{+openTickets}+/gi, cached.openTickets)
					.replace(/{+totalTickets}+/gi, cached.totalTickets);
				client.user.setPresence({
					activities: [activity],
					status: client.config.presence.status,
				});
				next++;
				if (next === client.config.presence.activities.length) next = 0;
			};
			setPresence();
			if (client.config.presence.activities.length > 1) setInterval(() => setPresence(), client.config.presence.interval * 1000);
		} else {
			client.log.info('Presence activities are disabled');
		}

		// stats posting
		if (client.config.stats) {
			sendToHouston(client);
			setInterval(() => sendToHouston(client), ms('12h'));
		}

		if (client.config.updates) {
			checkForUpdates(client);
			setInterval(() => checkForUpdates(client), ms('1w'));
		}

		// send inactivity warnings and close stale tickets
		const staleInterval = ms('5m');
		setInterval(async () => {
			// close stale tickets
			for (const [ticketId, $] of client.tickets.$stale) {
				const autoCloseAfter = $.closeAt - $.staleSince;
				const halfway = $.closeAt - (autoCloseAfter / 2);
				if (Date.now() >= halfway && Date.now() < halfway + staleInterval) {
					const channel = client.channels.cache.get(ticketId);
					if (!channel) continue;
					const { guild } = await client.prisma.ticket.findUnique({
						select: { guild: true },
						where: { id: ticketId },
					});
					const getMessage = client.i18n.getLocale(guild.locale);
					await channel.send({
						embeds: [
							new ExtendedEmbedBuilder()
								.setColor(guild.primaryColour)
								.setTitle(getMessage('ticket.closing_soon.title'))
								.setDescription(getMessage('ticket.closing_soon.description', { timestamp: Math.floor($.closeAt / 1000) })),
						],
					});
				} else if ($.closeAt < Date.now()) {
					client.tickets.finallyClose(ticketId, $);
				}
			}

			const guilds = await client.prisma.guild.findMany({
				include: {
					tickets: {
						include: { category: true },
						where: { open: true },
					},
				},
				// where: { staleAfter: { not: null } },
				where: { staleAfter: { gte: staleInterval } },
			});

			// set inactive tickets as stale
			for (const guild of guilds) {
				for (const ticket of guild.tickets) {
					if (client.tickets.$stale.has(ticket.id)) continue;
					if (ticket.lastMessageAt && Date.now() - ticket.lastMessageAt > guild.staleAfter) {
					/** @type {import("discord.js").TextChannel} */
						const channel = client.channels.cache.get(ticket.id);
						const messages = (await channel.messages.fetch({ limit: 5 })).filter(m => m.author.id !== client.user.id);
						let ping = '';

						if (messages.size > 0) {
							const lastMessage =  messages.first();
							const staff = await isStaff(channel.guild, lastMessage.author.id);
							if (staff) ping = `<@${ticket.createdById}>`;
							else ping = ticket.category.pingRoles.map(r => `<@&${r}>`).join(' ');
						}

						const getMessage = client.i18n.getLocale(guild.locale);
						const closeCommand = client.application.commands.cache.find(c => c.name === 'close');
						const sent = await channel.send({
							components: [
								new ActionRowBuilder()
									.addComponents(
										new ButtonBuilder()
											.setCustomId(JSON.stringify({ action: 'close' }))
											.setStyle(ButtonStyle.Danger)
											.setEmoji(getMessage('buttons.close.emoji'))
											.setLabel(getMessage('buttons.close.text')),
									),
							],
							content: ping,
							embeds: [
								new ExtendedEmbedBuilder({
									iconURL: channel.guild.iconURL(),
									text: guild.footer,
								})
									.setColor(guild.primaryColour)
									.setTitle(getMessage('ticket.inactive.title'))
									.setDescription(getMessage('ticket.inactive.description', {
										close: `</${closeCommand.name}:${closeCommand.id}>`,
										timestamp: Math.floor(ticket.lastMessageAt.getTime() / 1000),
									})),
							],
						});

						client.tickets.$stale.set(ticket.id, {
							closeAt: guild.autoClose ? Date.now() + guild.autoClose : null,
							closedBy: null,
							message: sent,
							messages: 0,
							reason: 'inactivity',
							staleSince: Date.now(),
						});
					}
				}
			}
		}, staleInterval);
	}
};
