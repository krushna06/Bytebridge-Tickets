const { SlashCommand } = require('@eartharoid/dbf');
const { sendToHouston } = require('../../lib/stats');

module.exports = class StatsSlashCommand extends SlashCommand {
    constructor(client, options) {
        const name = 'stats';
        super(client, {
            ...options,
            description: 'Hello',
            // descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
            dmPermission: false,
            name,
            // nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
        });
    }

    /**
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async run(interaction) {
        /** @type {import("client")} */
        const client = this.client;

        await interaction.deferReply({ ephemeral: false });

        try {
            await sendToHouston(client);
            await interaction.editReply('Stats have been successfully sent to Houston.');
        } catch (error) {
            client.log.error('Error sending stats:', error);
            await interaction.editReply('An error occurred while sending stats. Please try again later.');
        }
    }
};
