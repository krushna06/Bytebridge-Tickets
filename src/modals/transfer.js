const { Modal } = require('@eartharoid/dbf');
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const ExtendedEmbedBuilder = require('../lib/embed');
const { isStaff } = require('../lib/users');
const { logTicketEvent } = require('../lib/logging');

module.exports = class TransferModal extends Modal {
  constructor(client, options) {
    super(client, {
      ...options,
      id: 'transferTicket',
    });
  }

  /**
   * Handles the transfer modal submission
   * @param {*} id - Modal ID data
   * @param {import("discord.js").ModalSubmitInteraction} interaction - Modal interaction
   */
  async run(id, interaction) {
    /** @type {import("client")} */
    const client = this.client;

    await interaction.deferReply();

    // Get ticket details with question answers count for button display
    const ticket = await client.prisma.ticket.findUnique({
      include: {
        claimedBy: true,
        category: true,
        guild: true,
        _count: { select: { questionAnswers: true } }
      },
      where: { id: interaction.channel.id },
    });

    // If this isn't a ticket channel, show an error
    if (!ticket) {
      return await interaction.editReply({
        embeds: [
          new ExtendedEmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Error')
            .setDescription('This command can only be used in a ticket channel.'),
        ],
      });
    }

    // Extract the user input
    const userInput = interaction.fields.getTextInputValue('userMention').trim();
    let targetMember = null;
    
    try {
      // Try different methods to find the member
      
      // Method 1: Check if it's a direct ID
      if (/^\d+$/.test(userInput)) {
        try {
          targetMember = await interaction.guild.members.fetch(userInput);
        } catch (err) {
          client.log.verbose(`Not a valid member ID: ${userInput}`);
        }
      }
      
      // Method 2: Check if it's a mention format <@id>
      if (!targetMember) {
        const mentionMatch = userInput.match(/<@!?(\d+)>/);
        if (mentionMatch) {
          try {
            targetMember = await interaction.guild.members.fetch(mentionMatch[1]);
          } catch (err) {
            client.log.verbose(`Mention didn't resolve to valid member: ${userInput}`);
          }
        }
      }
      
      // Method 3: Search by username (with @ prefix support)
      if (!targetMember) {
        // Remove @ if present
        const searchName = userInput.startsWith('@') ? userInput.substring(1) : userInput;
        
        // Fetch all members (this could be expensive in large servers)
        const allMembers = await interaction.guild.members.fetch();
        
        // First try exact match
        targetMember = allMembers.find(member => 
          member.user.username.toLowerCase() === searchName.toLowerCase() ||
          member.displayName.toLowerCase() === searchName.toLowerCase()
        );
        
        // If no exact match, try partial match as a last resort
        if (!targetMember) {
          targetMember = allMembers.find(member => 
            member.user.username.toLowerCase().includes(searchName.toLowerCase()) ||
            member.displayName.toLowerCase().includes(searchName.toLowerCase())
          );
        }
      }
      
      // If we still can't find a member, throw an error
      if (!targetMember) {
        throw new Error('Member not found');
      }
      
      const targetUserId = targetMember.id;
      
      // Verify the target user is a staff member
      const isTargetStaff = await isStaff(interaction.guild, targetUserId);

      if (!isTargetStaff) {
        return await interaction.editReply({
          embeds: [
            new ExtendedEmbedBuilder({
              iconURL: interaction.guild.iconURL(),
              text: ticket.guild.footer,
            })
              .setColor(ticket.guild.errorColour)
              .setTitle('Invalid Staff Member')
              .setDescription('The selected user is not a staff member.'),
          ],
        });
      }

      // Transfer the ticket
      const previousClaimant = ticket.claimedById;

      // First, update the database
      await client.prisma.ticket.update({
        data: {
          claimedBy: {
            connect: { id: targetUserId },
          },
        },
        where: { id: interaction.channel.id },
      });
      
      // Update permissions - similar to the claim method
      await Promise.all([
        // Remove previous claimant's permissions
        interaction.channel.permissionOverwrites.delete(previousClaimant, `Ticket transferred by ${interaction.user.tag}`),
        
        // Make ticket invisible to all staff roles (same as claim behavior)
        ...ticket.category.staffRoles.map(role => 
          interaction.channel.permissionOverwrites.edit(role, { 'ViewChannel': false }, 
          `Ticket transferred by ${interaction.user.tag}`)
        ),
        
        // Give new staff member access
        interaction.channel.permissionOverwrites.edit(targetUserId, 
          { 
            ViewChannel: true,
            ReadMessageHistory: true,
            SendMessages: true,
            EmbedLinks: true,
            AttachFiles: true
          }, 
          `Ticket transferred by ${interaction.user.tag}`
        )
      ]);

      // Update the opening message buttons to match claim behavior
      const openingMessage = await interaction.channel.messages.fetch(ticket.openingMessageId);
      if (openingMessage && openingMessage.components.length !== 0) {
        const components = new ActionRowBuilder();

        // Add Edit button if ticket has a topic or questions
        if (ticket.topic || ticket._count?.questionAnswers !== 0) {
          components.addComponents(
            new ButtonBuilder()
              .setCustomId(JSON.stringify({ action: 'edit' }))
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('✏️')
              .setLabel('Edit'),
          );
        }

        // Add unclaim button (like after a normal claim)
        if (ticket.guild.claimButton && ticket.category.claiming) {
          components.addComponents(
            new ButtonBuilder()
              .setCustomId(JSON.stringify({ action: 'unclaim' }))
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔓')
              .setLabel('Unclaim'),
          );
        }

        // Keep the transfer button
        components.addComponents(
          new ButtonBuilder()
            .setCustomId(JSON.stringify({ action: 'transfer' }))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
            .setLabel('Transfer'),
        );

        // Add Close button if enabled
        if (ticket.guild.closeButton) {
          components.addComponents(
            new ButtonBuilder()
              .setCustomId(JSON.stringify({ action: 'close' }))
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒')
              .setLabel('Close'),
          );
        }

        // Update the message with new buttons
        await openingMessage.edit({ components: [components] });
      }

      // Send success message in channel
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(ticket.guild.primaryColour)
            .setDescription(`Ticket transferred from <@${previousClaimant}> to <@${targetUserId}> by ${interaction.user}.`),
        ],
      });

      // Log the transfer event
      logTicketEvent(client, {
        action: 'update',
        diff: {
          original: { claimedBy: previousClaimant },
          updated: { claimedBy: targetUserId },
        },
        target: {
          id: ticket.id,
          name: `<#${ticket.id}>`,
        },
        userId: interaction.user.id,
      });

    } catch (error) {
      // Handle member lookup errors
      client.log.error('Failed to find member:', userInput, error);
      return await interaction.editReply({
        embeds: [
          new ExtendedEmbedBuilder({
            iconURL: interaction.guild.iconURL(),
            text: ticket.guild.footer,
          })
            .setColor(ticket.guild.errorColour)
            .setTitle('Invalid User')
            .setDescription('Could not find that user. Please provide a valid username or mention (e.g., @staff_member).'),
        ],
      });
    }
  }
};