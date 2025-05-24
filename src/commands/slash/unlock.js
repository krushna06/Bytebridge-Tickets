const { SlashCommand } = require('@eartharoid/dbf');
const ExtendedEmbedBuilder = require('../../lib/embed');
module.exports = class UnlockSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'unlock';
		const description = client.i18n?.getMessage?.(null, `commands.slash.${name}.description`) || 'Unlock this ticket so the creator can send messages again.';
		super(client, {
			...options,
			description,
			descriptionLocalizations: client.i18n?.getAllMessages?.(`commands.slash.${name}.description`) || undefined,
			dmPermission: false,
			name,
			nameLocalizations: client.i18n?.getAllMessages?.(`commands.slash.${name}.name`) || undefined,
		});
	}
	async run(interaction) {
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
		if (!creatorId || typeof creatorId !== 'string' || !/^\d{15,20}$/.test(creatorId)) {
			console.error('Invalid creatorId:', creatorId, typeof creatorId);
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle('Could not determine a valid ticket creator.')
				],
			});
		}
		let member;
		try {
			member = await interaction.guild.members.fetch(creatorId);
		} catch (e) {
			member = null;
		}
		if (!member) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle('Ticket creator is no longer in the server.')
				],
			});
		}
		const ticketChannel = await interaction.guild.channels.fetch(ticket.id);
		try {
			await client.prisma.ticket.update({
				where: { id: ticket.id },
				data: {
					locked: false,
					locked_at: null,
					scheduled_deletion_at: null,
				},
			});
			await ticketChannel.permissionOverwrites.edit(
				creatorId,
				{ SendMessages: true },
				`${interaction.user.tag} unlocked the ticket`
			);
			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.primaryColour)
						.setDescription(getMessage('commands.slash.unlock.success') || 'Ticket unlocked. The creator can send messages again.'),
				],
			});
			await ticketChannel.send({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.successColour)
						.setTitle('🔓 Unlocked')
						.setDescription('You may reply back if needed.')
				]
			});
		} catch (err) {
			console.error('Permission overwrite error:', err);
			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.errorColour)
						.setDescription(getMessage('commands.slash.unlock.failed', { error: err.message }) || `Failed to unlock the ticket: ${err.message}`),
				],
			});
		}
	}
};
