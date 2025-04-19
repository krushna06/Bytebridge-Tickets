const { SlashCommand } = require('@eartharoid/dbf');
const { isStaff } = require('../../lib/users');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { version } = require('../../../package.json');

module.exports = class HelpSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'help';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		const { client } = interaction;
		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		const getMessage = client.i18n.getLocale(settings.locale);

		const commands = interaction.client.application.commands.cache
			.sort((a, b) => a.name.localeCompare(b.name));

		// Split commands into categories
		const commandCategories = {
			general: ['help', 'new', 'tickets', 'tag'],
			ticket: ['close', 'topic', 'rename', 'transcript'],
			staff: ['claim', 'release', 'force-close', 'move', 'priority'],
			members: ['add', 'remove', 'transfer'],
			notes: ['note', 'stickynotes', 'viewnotes'],
			stats: ['leaderboard', 'stats', 'viewprofile', 'setprofile']
		};

		const embed = new ExtendedEmbedBuilder()
			.setColor(settings.primaryColour)
			.setTitle(getMessage('commands.slash.help.response.commands'))
			.setDescription(getMessage('commands.slash.help.response.description', {
				command: '</new:' + commands.find(cmd => cmd.name === 'new')?.id + '>'
			}));

		// Create fields for each category
		for (const [category, commandList] of Object.entries(commandCategories)) {
			const categoryCommands = commands
				.filter(cmd => commandList.includes(cmd.name))
				.map(cmd => `> </${cmd.name}:${cmd.id}>: ${cmd.description}`)
				.join('\n');

			if (categoryCommands) {
				embed.addFields({
					name: category.charAt(0).toUpperCase() + category.slice(1),
					value: categoryCommands
				});
			}
		}

		embed.addFields({
			name: getMessage('commands.slash.help.response.links.links'),
			value: [
				`[${getMessage('commands.slash.help.response.links.docs')}](https://discordtickets.app/docs)`,
				`[${getMessage('commands.slash.help.response.links.commands')}](https://discordtickets.app/commands)`,
				`[${getMessage('commands.slash.help.response.links.support')}](https://discord.gg/discord-tickets)`,
				`[${getMessage('commands.slash.help.response.links.feedback')}](https://discord.gg/discord-tickets/feedback)`
			].join('\n')
		});

		return interaction.reply({ embeds: [embed] });
	}
};
