const { version } = require('../../package.json');
const {
	md5,
	msToMins,
} = require('./misc');

module.exports.getAvgResolutionTime = tickets => (tickets.reduce((total, ticket) => total + (ticket.closedAt - ticket.createdAt), 0) || 1) / Math.max(tickets.length, 1);

module.exports.getAvgResponseTime = tickets => (tickets.reduce((total, ticket) => total + (ticket.firstResponseAt - ticket.createdAt), 0) || 1) / Math.max(tickets.length, 1);

module.exports.getAvgResolutionTimePerUser = tickets => {
    const userResolutionTimes = {};

    tickets.forEach(ticket => {
        if (!ticket.claimedById || !ticket.closedAt) return;
        const resolutionTime = ticket.closedAt - ticket.createdAt;

        if (!userResolutionTimes[ticket.claimedById]) {
            userResolutionTimes[ticket.claimedById] = { total: 0, count: 0 };
        }

        userResolutionTimes[ticket.claimedById].total += resolutionTime;
        userResolutionTimes[ticket.claimedById].count++;
    });

    const avgResolutionTimes = {};
    for (const userId in userResolutionTimes) {
        avgResolutionTimes[userId] = userResolutionTimes[userId].total / Math.max(userResolutionTimes[userId].count, 1);
    }

    return avgResolutionTimes;
};

module.exports.getAvgResponseTimePerUser = tickets => {
    const userResponseTimes = {};

    tickets.forEach(ticket => {
        if (!ticket.claimedById || !ticket.firstResponseAt) return;
        const responseTime = ticket.firstResponseAt - ticket.createdAt;

        if (!userResponseTimes[ticket.claimedById]) {
            userResponseTimes[ticket.claimedById] = { total: 0, count: 0 };
        }

        userResponseTimes[ticket.claimedById].total += responseTime;
        userResponseTimes[ticket.claimedById].count++;
    });

    const avgResponseTimes = {};
    for (const userId in userResponseTimes) {
        avgResponseTimes[userId] = userResponseTimes[userId].total / Math.max(userResponseTimes[userId].count, 1);
    }

    return avgResponseTimes;
};


/**
 *
 * @param {import("../client")} client
 */
module.exports.sendToHouston = async client => {
	const guilds = await client.prisma.guild.findMany({
		include: {
			categories: { include: { _count: { select: { questions: true } } } },
			tags: true,
			tickets: {
				select: {
					closedAt: true,
					createdAt: true,
					firstResponseAt: true,
				},
			},
		},
	});
	const users = await client.prisma.user.findMany({ select: { messageCount: true } });
	const stats = {
		activated_users: users.length,
		arch: process.arch,
		database: process.env.DB_PROVIDER,
		guilds: guilds.filter(guild => {
			if (!client.guilds.cache.has(guild.id)) {
				client.log.warn('Guild %s is in the database but is not cached and might not exist. It will be excluded from the stats report.', guild.id);
				return false;
			}
			return true;
		}).map(guild => {
			const closedTickets = guild.tickets.filter(t => t.firstResponseAt && t.closedAt);
			return {
				avg_resolution_time: msToMins(closedTickets.reduce((total, ticket) => total + (ticket.closedAt - ticket.createdAt), 0) ?? 1 / closedTickets.length),
				avg_response_time: msToMins(closedTickets.reduce((total, ticket) => total + (ticket.firstResponseAt - ticket.createdAt), 0) ?? 1 / closedTickets.length),
				categories: guild.categories.length,
				features: {
					auto_close: msToMins(guild.autoClose),
					claiming: guild.categories.filter(c => c.claiming).length,
					feedback: guild.categories.filter(c => c.enableFeedback).length,
					logs: !!guild.logChannel,
					questions: guild.categories.filter(c => c._count.questions).length,
					tags: guild.tags.length,
					tags_regex: guild.tags.filter(t => t.regex).length,
					topic: guild.categories.filter(c => c.requireTopic).length,
				},
				id: md5(guild.id),
				locale: guild.locale,
				members: client.guilds.cache.get(guild.id).memberCount,
				messages: users.reduce((total, user) => total + user.messageCount, 0),
				tickets: guild.tickets.length,
			};
		}),
		id: md5(client.user.id),
		node: process.version,
		os: process.platform,
		version,
	};
	try {
		client.log.verbose('Reporting to Houston:', stats);
		const res = await fetch('https://stats.discordtickets.app/api/v4/houston', {
			body: JSON.stringify(stats),
			headers: { 'content-type': 'application/json' },
			method: 'POST',
		});
		if (!res.ok) throw res;
		client.log.success('Posted client stats');
		client.log.debug(res);
	} catch (res) {
		client.log.warn('The following error is not important and can be safely ignored');
		try {
			const json = await res.json();
			client.log.error('An error occurred whilst posting stats:', json);
		} catch (error) {
			client.log.error('An error occurred whilst posting stats and the response couldn\'t be parsed:', error.message);
		}
		client.log.debug(res);
	}
};
