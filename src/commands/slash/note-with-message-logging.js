const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType, ThreadAutoArchiveDuration, MessageFlags, Events } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const { logTicketEvent } = require('../../lib/logging');

module.exports = class NoteSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'note';
		super(client, {
			...options,
			description: 'Create a private note thread that only staff can see',
			dmPermission: false,
			name,
			options: [
				{
					name: 'text',
					description: 'The initial note content',
					required: true,
					type: ApplicationCommandOptionType.String,
				},
			],
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import("client")} */
		const client = this.client;

		// Use flags instead of ephemeral parameter
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		// Check if the command is being used in a ticket channel
		const ticket = await client.prisma.ticket.findUnique({
			include: { guild: true },
			where: { id: interaction.channel.id },
		});
		
		// Check if a staff notes thread already exists
		const existingThreads = interaction.channel.threads.cache.filter(
			thread => thread.name.startsWith('💬 Staff Notes') && thread.type === 11
		);

		if (!ticket) {
			const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle('❌ This isn\'t a ticket channel')
						.setDescription('You can only use this command in tickets.'),
				],
			});
		}

		// Check if user is staff
		if (!(await isStaff(interaction.guild, interaction.user.id))) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle('❌ Access Denied')
						.setDescription('Only staff members can create notes.'),
				],
			});
		}

		const noteText = interaction.options.getString('text', true);
		let thread;

		// If a notes thread already exists, use that instead of creating a new one
		if (existingThreads.size > 0) {
			thread = existingThreads.first();
			
			// Send the note to the existing thread
			await thread.send({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.primaryColour)
						.setDescription(noteText)
						.setAuthor({
							iconURL: interaction.user.displayAvatarURL(),
							name: interaction.member.displayName,
						})
						.setTimestamp(),
				],
			});

			// Log the added note to the logs channel
			logTicketEvent(this.client, {
				action: 'update',
				diff: {
					original: {},
					updated: { 'Staff Note': noteText },
				},
				target: {
					id: ticket.id,
					name: `<#${ticket.id}>`,
				},
				userId: interaction.user.id,
			});

			// Send a confirmation message
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.successColour)
						.setTitle('✅ Note Added')
						.setDescription(`Added note to the existing staff thread: ${thread}`),
				],
			});
		}

		try {
			// Create a private thread
			const threadName = `💬 Staff Notes - #${ticket.number}`;
			thread = await interaction.channel.threads.create({
				name: threadName,
				autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
				reason: `Staff note created by ${interaction.user.tag}`,
				type: 11, // PrivateThread
			});

			// Fetch the ticket category to get staff roles
			const category = await client.prisma.category.findUnique({
				where: { id: ticket.categoryId },
				select: { staffRoles: true }
			});

			// Remove any non-staff members from the thread - without using the deprecated reason parameter
			const threadMembers = await thread.members.fetch();
			for (const [memberId, threadMember] of threadMembers) {
				const member = await interaction.guild.members.fetch(memberId).catch(() => null);
				if (member && !(await isStaff(interaction.guild, memberId))) {
					await thread.members.remove(memberId);
				}
			}

			// Make sure the ticket creator can't access the thread regardless of roles
			// Removed the deprecated reason parameter
			if (ticket.createdById) {
				await thread.members.remove(ticket.createdById);
			}

			// Send a message explaining the purpose of the thread
			const infoMessage = await thread.send({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.primaryColour)
						.setTitle('📝 Staff Notes Thread')
						.setDescription(
							'This is a private thread for staff notes about this ticket. ' +
							'Any messages sent here are only visible to staff members. ' +
							'The ticket creator and regular users cannot see this thread.'
						)
						.setFooter({
							text: 'Use this thread to discuss the ticket or share private information',
						}),
				],
			});
			
			// Pin the info message
			await infoMessage.pin();
			
			// Send initial note message
			const initialMessage = await thread.send({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.primaryColour)
						.setTitle('📝 Staff Note')
						.setDescription(noteText)
						.setAuthor({
							iconURL: interaction.user.displayAvatarURL(),
							name: interaction.member.displayName,
						})
						.setFooter({
							text: 'Only staff members can see this thread',
						})
						.setTimestamp(),
				],
			});

			// Add the creator of this note to the thread
			await thread.members.add(interaction.user.id);
			
			// Pin the initial message (but not the system message about pinning)
			await initialMessage.pin();
			
			// Clean up the system message about pinning
			const systemMessages = await thread.messages.fetch({ limit: 10 });
			for (const [, message] of systemMessages) {
				if (message.system && message.type === 6) { // CHANNEL_PINNED_MESSAGE type
					await message.delete().catch(() => {});
				}
			}

			// Send a confirmation message
			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.successColour)
						.setTitle('✅ Note Created')
						.setDescription(`Created a private staff notes thread: ${thread}`),
				],
			});

			// Log the creation of the notes thread and the initial note
			logTicketEvent(this.client, {
				action: 'update',
				diff: {
					original: {},
					updated: { 
						'Staff Notes': 'Thread created',
						'Staff Note': noteText
					},
				},
				target: {
					id: ticket.id,
					name: `<#${ticket.id}>`,
				},
				userId: interaction.user.id,
			});

			// Set up event listener for future messages in this thread
			// This listener needs to be unique to avoid duplicate handlers
			const listenerKey = `staff-notes-${thread.id}`;
			
			// Create a message listener for the thread
			const messageListener = async message => {
				// Only log messages from this specific thread, not embeds/system messages
				if (message.channel.id === thread.id && 
					!message.system && 
					!message.author.bot && 
					message.content) {
					
					// Log the note to the logs channel
					logTicketEvent(client, {
						action: 'update',
						diff: {
							original: {},
							updated: { 
								'Staff Note': message.content,
								'From': message.author.tag
							},
						},
						target: {
							id: ticket.id,
							name: `<#${ticket.id}>`,
						},
						userId: message.author.id,
					});
				}
			};
			
			// Store the listener reference for potential cleanup later
			if (!client.staffNoteListeners) {
				client.staffNoteListeners = new Map();
			}
			
			// Remove existing listener if it exists
			if (client.staffNoteListeners.has(listenerKey)) {
				client.off(Events.MessageCreate, client.staffNoteListeners.get(listenerKey));
			}
			
			// Add the new listener
			client.staffNoteListeners.set(listenerKey, messageListener);
			client.on(Events.MessageCreate, messageListener);

		} catch (error) {
			client.log.error('Error creating notes thread:', error);
			
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle('⚠️ Error')
						.setDescription('Failed to create the notes thread. Please try again.'),
				],
			});
		}
	}
};