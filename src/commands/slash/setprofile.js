const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

module.exports = class SetProfileSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'setprofile';
		super(client, {
			...options,
			description: 'Set your staff profile information',
			dmPermission: false,
			name,
			options: [
				{
					description: 'Set your staff biography',
					max_length: 1000,
					name: 'bio',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					description: 'Set your active hours (e.g., "10:00-18:00")',
					name: 'activehours',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
			],
		});
	}

	async run(interaction) {
		await interaction.deferReply();

		const settings = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

		// Check if user is staff
		if (!(await isStaff(interaction.guild, interaction.user.id))) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle('❌ Error')
						.setDescription('Only staff members can set their profile.'),
				],
			});
		}

		const bio = interaction.options.getString('bio');
		const activeHours = interaction.options.getString('activehours');

		// Validate active hours format if provided
		if (activeHours) {
			const timeRangeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
			if (!timeRangeRegex.test(activeHours)) {
				return await interaction.editReply({
					embeds: [
						new ExtendedEmbedBuilder({
							iconURL: interaction.guild.iconURL(),
							text: settings.footer,
						})
							.setColor(settings.errorColour)
							.setTitle('❌ Invalid Format')
							.setDescription('Please use the format "HH:MM-HH:MM" (e.g., "10:00-18:00") for active hours.'),
					],
				});
			}
		}

		// Update or create user profile
		await this.client.prisma.user.upsert({
			create: {
				activeHours: activeHours ? JSON.stringify([activeHours]) : '[]',
				bio: bio || null,
				id: interaction.user.id,
				hasProfile: true,
			},
			update: {
				...(bio && { bio }),
				...(activeHours && { activeHours: JSON.stringify([activeHours]) }),
				hasProfile: true,
			},
			where: { id: interaction.user.id },
		});

		const updatedFields = [];
		if (bio) updatedFields.push('Biography');
		if (activeHours) updatedFields.push('Active Hours');

		return await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.successColour)
					.setTitle('✅ Profile Updated')
					.setDescription(`Successfully updated: ${updatedFields.join(', ')}`)
					.addFields(
						...(bio ? [{
							name: 'Biography',
							value: bio,
						}] : []),
						...(activeHours ? [{
							name: 'Active Hours',
							value: activeHours,
						}] : []),
					),
			],
		});
	}
};