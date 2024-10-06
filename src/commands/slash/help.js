const { SlashCommand } = require('@eartharoid/dbf');
const { isStaff } = require('../../lib/users');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { version } = require('../../../package.json');

function chunkString(str, maxLength) {
	const chunks = [];
	while (str.length > maxLength) {
		let sliceIndex = str.lastIndexOf('\n', maxLength);
		if (sliceIndex === -1) sliceIndex = maxLength;
		chunks.push(str.slice(0, sliceIndex));
		str = str.slice(sliceIndex).trim();
	}
	if (str.length > 0) chunks.push(str);
	return chunks;
}

module.exports = class ClaimSlashCommand extends SlashCommand {
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
		/** @type {import("client")} */
		const client = this.client;

		await interaction.deferReply({ ephemeral: true });
		const staff = await isStaff(interaction.guild, interaction.member.id);
		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		const getMessage = client.i18n.getLocale(settings.locale);
		const commands = client.application.commands.cache
			.filter(c => c.type === 1)
			.map(c => `> </${c.name}:${c.id}>: ${c.description}`)
			.join('\n');

		const links = staff
			? [
				`> [${getMessage('commands.slash.help.response.links.feedback')}](https://discord.gg/gWRhsZHHeb)`,
				`> [${getMessage('commands.slash.help.response.links.support')}](https://discord.gg/gWRhsZHHeb)`,
				`> ${getMessage('commands.slash.help.response.settings')}: ${process.env.HTTP_EXTERNAL}/settings`
			].join('\n')
			: '';

		let description = staff
			? `**Bytebridge Limited v${version} by nostep.**\n\n${links}\n\n${commands}`
			: getMessage('commands.slash.help.response.description', { command: `</new:${client.application.commands.cache.find(c => c.name === 'new').id}>` }) + `\n\n${commands}`;

		const descriptionChunks = chunkString(description, 4096);

		const embeds = descriptionChunks.map((chunk, index) => new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(settings.primaryColour)
			.setTitle(index === 0 ? getMessage('commands.slash.help.title') : null)
			.setDescription(chunk)
		);

		interaction.editReply({
			embeds: embeds,
		});
	}
};
