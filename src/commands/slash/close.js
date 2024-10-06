const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');

module.exports = class CloseSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'close';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					name: 'reason',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'premade_reasons',
					description: 'Select a predefined reason for closing the ticket',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{
							name: 'We\'re aware of this issue, it will be fixed soon',
							value: 'issue_fix_soon',
						},
						{
							name: 'Ticket has been resolved',
							value: 'ticket_resolved',
						},
						{
							name: 'Your ban request has been denied',
							value: 'ban_request_denied',
						},
					],
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'] || 'No description provided';

				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				return option;
			}),
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import("client")} */
		const client = this.client;
		const reason = interaction.options.getString('reason');
		const premadeReasons = interaction.options.getString('premade_reasons');

		console.log('Reason:', reason);
		console.log('Predefined Reason:', premadeReasons);

		await client.tickets.beforeRequestClose(interaction);
	}
};
