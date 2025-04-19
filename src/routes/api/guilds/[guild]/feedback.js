const Cryptr = require('cryptr');
const { decrypt } = new Cryptr(process.env.ENCRYPTION_KEY);
const ms = require('ms');

module.exports.get = fastify => ({
	handler: async req => {
		/** @type {import("client")} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;

		// Get cached feedback or fetch new
		const cacheKey = `cache/guild-feedback:${guildId}`;
		let feedback = await client.keyv.get(cacheKey);

		if (!feedback) {
			// Fetch feedback with related data
			const tickets = await client.prisma.ticket.findMany({
				select: {
					feedback: {
						id: true,
						select: {
							comment: true,
							createdAt: true,
							rating: true,
							user: { select: { id: true } },
						},
					},
				},
				where: {
					feedback: { isNot: null },
					guildId,
				},
			});

			// Process the feedback and fetch Discord usernames
			feedback = await Promise.all(tickets.map(async ticket => {
				// Fetch Discord user data
				const user = await client.users.fetch(ticket.feedback.user.id).catch(() => null);

				return {
					comment: ticket.feedback.comment ? decrypt(ticket.feedback.comment) : null,
					createdAt: ticket.feedback.createdAt,
					id: ticket.id,
					rating: ticket.feedback.rating,
					user: {
						id: ticket.feedback.user.id,
						username: user ? user.username : 'Unknown User',
					},
				};
			}));

			// Calculate statistics
			const stats = {
				averageRating: feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length || 0,
				distribution: {
					1: feedback.filter(f => f.rating === 1).length,
					2: feedback.filter(f => f.rating === 2).length,
					3: feedback.filter(f => f.rating === 3).length,
					4: feedback.filter(f => f.rating === 4).length,
					5: feedback.filter(f => f.rating === 5).length,
				},
				total: feedback.length,
			};

			const response = {
				feedback,
				stats,
			};

			// Cache for 5 minutes
			await client.keyv.set(cacheKey, response, ms('5m'));
			return response;
		}

		return feedback;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});