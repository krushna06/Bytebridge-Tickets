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
						{ name: 'Ticket Answered', value: 'ticket_answered' },
						{ name: 'Action Taken', value: 'action_taken' },
						{ name: 'Issue Resolved', value: 'issue_resolved' },
						{ name: 'Report Reviewed (Steps Taken)', value: 'report_reviewed_steps' },
						{ name: 'Report Reviewed (Community Safety)', value: 'report_reviewed_safety' },
						{ name: 'Bug Report Reviewed', value: 'bug_report_reviewed' },
						{ name: 'Appeal Accepted', value: 'appeal_accepted' },
						{ name: 'Appeal Denied', value: 'appeal_denied' }
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

const REASON_MAP = {
    ticket_answered: 'Ticket answered. Read transcript for details.',
    action_taken: 'Action Taken! Thank you for contacting Fusion Network.',
    issue_resolved: 'Issue resolved! Thank you for contacting Fusion Network.',
    report_reviewed_steps: 'Report reviewed and necessary steps taken. Thank you for your help.',
    report_reviewed_safety: 'Report reviewed. Steps taken. Thanks for keeping the community safe.',
    bug_report_reviewed: 'Bug noted. Team will fix soon. Thanks for helping improve Fusion Network.',
    appeal_accepted: 'Appeal accepted. Follow the rules moving forward. Welcome back!',
    appeal_denied: 'Appeal denied. Punishment remains due to evidence/past history.'
};