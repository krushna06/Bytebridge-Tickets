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
					choices: [
						{
							name: 'Ticket Answered',
							value: 'Ticket answered. Read transcript for details.'
						},
						{
							name: 'Action Taken',
							value: 'Action Taken! Thank you for contacting Fusion Network.'
						},
						{
							name: 'Issue Resolved',
							value: 'Issue resolved! Thank you for contacting Fusion Network.'
						},
						{
							name: 'Report Reviewed (Steps Taken)',
							value: 'Report reviewed and necessary steps taken. Thank you for your help.'
						},
						{
							name: 'Report Reviewed (Community Safety)',
							value: 'Report reviewed. Steps taken. Thanks for keeping the community safe.'
						},
						{
							name: 'Bug Report Reviewed',
							value: 'Bug noted. Team will fix soon. Thanks for helping improve Fusion Network.'
						},
						{
							name: 'Appeal Accepted',
							value: 'Appeal accepted. Follow the rules moving forward. Welcome back!'
						},
						{
							name: 'Appeal Denied',
							value: 'Appeal denied. Punishment remains due to evidence/past history.'
						}
					]					
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'];
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
		await client.tickets.beforeRequestClose(interaction);
	}
};
