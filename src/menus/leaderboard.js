const { Menu } = require('@eartharoid/dbf');

module.exports = class LeaderboardMenu extends Menu {
    constructor(client, options) {
        super(client, {
            ...options,
            id: 'leaderboard',
        });
    }

    async run(data, interaction) {
        const type = interaction.values[0];
        
        // Get the leaderboard command
        const command = this.client.commands.commands.slash.get('leaderboard');
        
        // Update the existing message
        await interaction.deferUpdate();
        
        // Run the command with the new type and editReply flag
        await command.run(interaction, { 
            type,
            isUpdate: true 
        });
    }
};