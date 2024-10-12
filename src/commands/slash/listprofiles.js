const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const profilesPath = path.join(__dirname, '../../../db/json/profiles.json');

module.exports = class ListProfilesSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'listprofiles';
		super(client, {
			...options,
			description: 'List all user profiles in the server.',
			dmPermission: false,
			name,
		});
	}

	async run(interaction) {
		let profiles;
		try {
			profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
		} catch (error) {
			return await interaction.reply({
				content: 'An error occurred while loading the profile data.',
				ephemeral: true,
			});
		}

		const profileEntries = Object.entries(profiles);
		if (profileEntries.length === 0) {
			return await interaction.reply({
				content: 'No profiles found.',
				ephemeral: true,
			});
		}

		const profileEmbed = new EmbedBuilder()
			.setColor('#0099ff')
			.setTitle('User Profiles')
			.setDescription('Here are the profiles of all users:');

		for (const [userId, profile] of profileEntries) {
			try {
				const user = await interaction.guild.members.fetch(userId);
				const username = user.user.username;

				profileEmbed.addFields(
					{
						name: username,
						value: `Bio: ${profile.bio || 'Not set'}, Timezone: ${profile.timezone || 'Not set'}`,
						inline: true,
					},
				);
			} catch (error) {
				console.error(`Could not fetch user with ID ${userId}:`, error);
			}
		}

		const iconURL = interaction.guild.iconURL() || null;

		profileEmbed.setTimestamp()
			.setFooter({
				text: 'User Profiles List',
				iconURL: iconURL,
			});

		await interaction.reply({
			embeds: [profileEmbed],
			ephemeral: true,
		});
	}
};
