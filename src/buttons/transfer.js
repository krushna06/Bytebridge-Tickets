const { Button } = require('@eartharoid/dbf');
const { 
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const ExtendedEmbedBuilder = require('../lib/embed');
const { isStaff } = require('../lib/users');

module.exports = class TransferButton extends Button {
  constructor(client, options) {
    super(client, {
      ...options,
      id: 'transfer',
    });
  }

  /**
   * Handles the transfer button click
   * @param {*} id - Button ID data
   * @param {import("discord.js").ButtonInteraction} interaction - Button interaction
   */
  async run(id, interaction) {
    /** @type {import("client")} */
    const client = this.client;

    // Check if the current channel is a ticket
    const ticket = await client.prisma.ticket.findUnique({
      include: {
        claimedBy: true,
        category: true,
        guild: true,
      },
      where: { id: interaction.channel.id },
    });

    // If this isn't a ticket channel, show an error
    if (!ticket) {
      return await interaction.reply({
        embeds: [
          new ExtendedEmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Error')
            .setDescription('This command can only be used in a ticket channel.'),
        ],
        ephemeral: true,
      });
    }

    // Check if user is a staff member
    if (!(await isStaff(interaction.guild, interaction.user.id))) {
      return await interaction.reply({
        embeds: [
          new ExtendedEmbedBuilder({
            iconURL: interaction.guild.iconURL(),
            text: ticket.guild.footer,
          })
            .setColor(ticket.guild.errorColour)
            .setTitle('Not Authorized')
            .setDescription('You must be a staff member to use this feature.'),
        ],
        ephemeral: true,
      });
    }

    // Check if ticket is claimed (must be claimed to transfer)
    if (!ticket.claimedById) {
      return await interaction.reply({
        embeds: [
          new ExtendedEmbedBuilder({
            iconURL: interaction.guild.iconURL(),
            text: ticket.guild.footer,
          })
            .setColor(ticket.guild.errorColour)
            .setTitle('Cannot Transfer')
            .setDescription('This ticket must be claimed before it can be transferred.'),
        ],
        ephemeral: true,
      });
    }

    // Show a modal to enter the staff member to transfer to
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(JSON.stringify({ action: 'transferTicket' }))
        .setTitle('Transfer Ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('userMention')
              .setLabel('Staff member to transfer to')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Enter username, ID, or @mention')
              .setRequired(true)
          )
        )
    );
  }
};