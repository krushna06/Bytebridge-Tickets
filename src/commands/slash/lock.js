const { SlashCommand } = require('@eartharoid/dbf');
const ExtendedEmbedBuilder = require('../../lib/embed');

module.exports = class LockSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'lock';
		const description = client.i18n?.getMessage?.(null, `commands.slash.${name}.description`) || 'Lock this ticket so the creator can no longer send messages.';
		super(client, {
			...options,
			description,
			descriptionLocalizations: client.i18n?.getAllMessages?.(`commands.slash.${name}.description`) || undefined,
			dmPermission: false,
			name,
			nameLocalizations: client.i18n?.getAllMessages?.(`commands.slash.${name}.name`) || undefined,
		});
	}

	/**
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import('client')} */
		const client = this.client;
		await interaction.deferReply({ ephemeral: true });

		const ticket = await client.prisma.ticket.findUnique({
			include: { guild: true },
			where: { id: interaction.channel.id },
		});

		if (!ticket) {
			const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
			const getMessage = client.i18n.getLocale(settings.locale);
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('misc.invalid_ticket.title'))
						.setDescription(getMessage('misc.invalid_ticket.description')),
				],
			});
		}

		const getMessage = client.i18n.getLocale(ticket.guild.locale);
		const creatorId = ticket.createdById;
		if (!creatorId) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle('Could not determine ticket creator.')
				],
			});
		}

		/** @type {import('discord.js').TextChannel} */
		const ticketChannel = await interaction.guild.channels.fetch(ticket.id);
		try {
			await ticketChannel.permissionOverwrites.edit(
				creatorId,
				{ SendMessages: false },
				`${interaction.user.tag} locked the ticket`
			);
			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.primaryColour)
						.setDescription(getMessage('commands.slash.lock.success') || 'Ticket locked. The creator can no longer send messages.'),
				],
			});
		} catch (err) {
			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.errorColour)
						.setDescription(getMessage('commands.slash.lock.failed', { error: err.message }) || `Failed to lock the ticket: ${err.message}`),
				],
			});
		}
	}
};
