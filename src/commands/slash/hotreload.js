const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = class HotreloadSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'hotreload';
        super(client, {
            ...options,
            description: 'Reload all commands without restarting the bot (Super Users only)',
            dmPermission: true,
            name,
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        // Check if user is a super user
        if (!interaction.client.supers.includes(interaction.user.id)) {
            return await interaction.reply({
                content: 'This command is only available to super users.',
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const loadingEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Hot Reloading Commands')
                .setDescription('Reloading all commands...')
                .setTimestamp();

            await interaction.reply({
                embeds: [loadingEmbed],
                flags: MessageFlags.Ephemeral,
            });

            const commandsPath = path.join(__dirname);
            const commandFiles = fs.readdirSync(commandsPath)
                .filter(file => file.endsWith('.js') && file !== 'hotreload.js');

            interaction.client.commands.components = [];

            for (const file of commandFiles) {
                try {
                    const filePath = path.join(commandsPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    interaction.client.commands.components.push(command);
                } catch (error) {
                    console.error(`Error reloading command ${file}:`, error);
                }
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Commands Reloaded Successfully')
                .setDescription(`Successfully reloaded ${commandFiles.length} commands.`)
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed],
            });
        } catch (error) {
            console.error('Error during hot reload:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Error During Hot Reload')
                .setDescription('An error occurred while reloading commands. Check the console for details.')
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed],
            });
        }
    }
}; 