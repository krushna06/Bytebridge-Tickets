const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

module.exports = class ProfilesSlashCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			name: 'profiles',
			description: 'View staff profiles including bio, active hours, and ratings',
			dmPermission: false,
		});
	}

	async run(interaction) {
		await interaction.deferReply();

		const settings = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

		const staffMembers = await this.client.prisma.user.findMany({
			where: {
				hasProfile: true,
			},
		});

		const embed = new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(settings.primaryColour)
			.setTitle('👥 Staff Profiles');

		let fieldValue = '';
		let count = 0;

		for (const member of staffMembers) {
			const user = await interaction.guild.members.fetch(member.id).catch(() => null);
			if (!user) continue;

			const bio = member.bio || 'No bio available';
			const activeHours = member.activeHours ? this.formatActiveHours(member.activeHours) : 'Not set';
			const averageRating = await this.getAverageRating(member.id);

			fieldValue += `**${user.displayName}**\nBio: ${bio}\nActive Hours: ${activeHours}\nRating: ${averageRating ? `${averageRating} ⭐` : 'No ratings'}`;

			count++;

			if (count % 3 === 0 || member === staffMembers[staffMembers.length - 1]) {
				embed.addFields({ name: '\u200B', value: fieldValue });
				fieldValue = '';
			} else {
				fieldValue += '\n\n';
			}
		}

		await interaction.editReply({ embeds: [embed] });
	}

	formatActiveHours(activeHours) {
		const [start, end] = JSON.parse(activeHours)[0].split('-');
		const now = new Date();
		const startTime = Math.floor(new Date(now.setHours(...start.split(':'))).getTime() / 1000);
		const endTime = Math.floor(new Date(now.setHours(...end.split(':'))).getTime() / 1000);
		return `<t:${startTime}:t> - <t:${endTime}:t>`;
	}

	async getAverageRating(userId) {
		const tickets = await this.client.prisma.ticket.findMany({
			include: { feedback: true },
			where: {
				closedById: userId,
				feedback: { isNot: null },
			},
		});

		if (tickets.length === 0) return null;

		const total = tickets.reduce((sum, ticket) => sum + ticket.feedback.rating, 0);
		return (total / tickets.length).toFixed(1);
	}
};