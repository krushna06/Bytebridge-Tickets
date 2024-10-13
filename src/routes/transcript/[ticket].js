const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports.get = fastify => ({
	handler: async req => {
		const client = req.routeOptions.config.client;
		const ticketId = req.params.ticket;
		const cmd = client.commands.commands.slash.get('transcript');
		const ticket = await prisma.tickets.findUnique({ where: { id: ticketId } });

		if (!ticket) {
			return fastify.httpErrors.notFound('Ticket not found');
		}

		const html = cmd.fillTemplate(ticket);

		return { html };
	},
	onRequest: [fastify.authenticate],
});
