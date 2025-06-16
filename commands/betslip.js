// commands/betslip.js

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');

const Capper = require('../models/Capper'); // Adjusted path
const Betslip = require('../models/Betslip'); // Adjusted path
const Settings = require('../models/Settings'); // Adjusted path from 'Settings'

// Helper function to convert American odds to Decimal odds
const convertAmericanToDecimal = (american) => {
  const odds = Number(american);
  if (isNaN(odds) || odds === 0) return null; // Handle non-numeric or zero input

  if (odds > 0) {
    return (odds / 100) + 1;
  }
  if (odds < 0) {
    return (100 / Math.abs(odds)) + 1;
  }
  return null; // Should not reach here if odds > 0 or < 0
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('betslip')
    .setDescription('Create a new betslip (Capper only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) // Cappers can use this if they have SendMessages
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Optional image attachment for the betslip')
        .setRequired(false),
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId; // Get guildId for consistency

    // Check if the user is a registered capper in this guild
    const isCapper = await Capper.findOne({ guildId: guildId, userId: userId });
    if (!isCapper) {
      const unauthorizedEmbed = new EmbedBuilder()
        .setColor('#AC3C49')
        .setDescription('❌ **Unauthorized** | You are not authorized to use this command. Only registered cappers can create betslips.');
      return interaction.reply({ embeds: [unauthorizedEmbed], ephemeral: true });
    }

    let selectedPlatform = null;
    let selectedSport = null;
    let selectedBetType = null;
    let uploadedImageUrl = interaction.options.getAttachment('image')?.url || null; // Get initial image if provided

    // Function to build the embed description based on current selections
    const buildDescription = () => [
      '1️⃣ Upload your betslip image below (max 1 image per betslip).',
      `**Platform:** ${selectedPlatform ? `\`${selectedPlatform}\`` : '_Not selected_'}`,
      `**Sport:** ${selectedSport ? `\`${selectedSport}\`` : '_Not selected_'}`,
      `**Bet Type:** ${selectedBetType ? `\`${selectedBetType}\`` : '_Not selected_'}`,
      uploadedImageUrl ? '🖼️ Image uploaded and previewed.' : '_No image uploaded yet_',
      '',
      'Click **Send Message** when ready or **Cancel Bet** to abort.',
    ].join('\n');

    // Initial embed for the betslip creation process (ephemeral)
    const initialEmbed = new EmbedBuilder()
      .setTitle('📋 Create a Betslip')
      .setDescription(buildDescription())
      .setColor('#AC3C49') // Purple color for the creation process
      .setFooter({ text: 'Fill in the details below. Purple vibes only!' });
    if (uploadedImageUrl) initialEmbed.setImage(uploadedImageUrl);

    // Dropdown for selecting Platform
    const platformSelect = new StringSelectMenuBuilder()
      .setCustomId('platform_select')
      .setPlaceholder('Select Platform')
      .addOptions(['Stake', 'Fanduel', 'Bet365', 'PrizePicks'].map(label => ({ label, value: label })));

    // Dropdown for selecting Sport
    const sportSelect = new StringSelectMenuBuilder()
      .setCustomId('sport_select')
      .setPlaceholder('Select Sport')
      .addOptions([
        'Multi-Sport', 'NBA', 'WNBA', 'College Basketball', 'MLB', 'College Baseball',
        'Tennis', 'Soccer', 'NFL', 'College Football', 'NHL', 'Cricket', 'MMA', 'Boxing', 'Rugby',
      ].map(label => ({ label, value: label })));

    // Dropdown for selecting Bet Type
    const betTypeSelect = new StringSelectMenuBuilder()
      .setCustomId('bet_type_select')
      .setPlaceholder('Select Bet Type')
      .addOptions([
        'Money Line', 'Spread', 'Parlay', 'Same Game Parlay', 'Props',
        'Round Robin', 'Totals (Over/Under)', 'Live Bets'
      ].map(label => ({ label, value: label })));

    // Buttons for Send and Cancel
    const sendButton = new ButtonBuilder().setCustomId('send_bet').setLabel('Send Message').setStyle(ButtonStyle.Primary);
    const cancelButton = new ButtonBuilder().setCustomId('cancel_bet').setLabel('Cancel Bet').setStyle(ButtonStyle.Danger);

    // Action rows for components
    const rows = [
      new ActionRowBuilder().addComponents(platformSelect),
      new ActionRowBuilder().addComponents(sportSelect),
      new ActionRowBuilder().addComponents(betTypeSelect),
      new ActionRowBuilder().addComponents(cancelButton, sendButton), // Order of buttons
    ];

    // Initial ephemeral reply to the user
    await interaction.reply({ embeds: [initialEmbed], components: rows, ephemeral: true });
    const message = await interaction.fetchReply(); // Get the reply message to create collectors on it
    const channel = interaction.channel; // Get the channel where the command was used

    // Function to update the initial ephemeral embed
    const updateEmbed = async () => {
      const updatedEmbed = new EmbedBuilder()
        .setTitle('📋 Create a Betslip')
        .setDescription(buildDescription())
        .setColor('#AC3C49')
        .setFooter({ text: 'Purple vibes only!' });
      if (uploadedImageUrl) updatedEmbed.setImage(uploadedImageUrl);
      await interaction.editReply({ embeds: [updatedEmbed] }); // Edit the original ephemeral reply
    };

    // Filter for collectors: ensure only the interacting user can trigger collectors
    const filter = i => i.user.id === userId;

    // Collector for message components (select menus and buttons)
    const componentCollector = message.createMessageComponentCollector({ filter, time: 10 * 60 * 1000 }); // 10 minutes timeout
    // Collector for image attachments
    const attachmentCollector = channel.createMessageCollector({
      filter: m => m.author.id === userId && m.attachments.size > 0,
      max: 1, // Only collect one image
      time: 10 * 60 * 1000, // 10 minutes timeout
    });

    // Handle collected attachments
    attachmentCollector.on('collect', async msg => {
      const image = msg.attachments.find(att => att.contentType?.startsWith('image'));
      if (!image) {
        await interaction.followUp({ content: '❌ Please upload a valid image file (PNG, JPG, GIF).', ephemeral: true });
        return;
      }
      uploadedImageUrl = image.url; // Store the URL of the uploaded image
      await updateEmbed(); // Update the ephemeral embed with the image preview
      try { await msg.delete(); } catch (e) { console.error("Could not delete user's image message:", e); } // Delete the user's message to keep chat clean
    });

    // Handle collected component interactions
    componentCollector.on('collect', async i => {
      if (i.isStringSelectMenu()) {
        // Update selected values based on dropdown selection
        if (i.customId === 'platform_select') selectedPlatform = i.values[0];
        if (i.customId === 'sport_select') selectedSport = i.values[0];
        if (i.customId === 'bet_type_select') selectedBetType = i.values[0];

        await i.update({ components: rows }); // Update interaction to keep dropdowns active
        await updateEmbed(); // Update the ephemeral embed description
      }

      if (i.isButton()) {
        // Handle Cancel Bet button
        if (i.customId === 'cancel_bet') {
          componentCollector.stop('cancelled');
          attachmentCollector.stop();
          await interaction.editReply({ content: '❌ Betslip creation cancelled.', components: [], embeds: [] });
          return;
        }

        // Handle Send Message button
        if (i.customId === 'send_bet') {
          // Validate that all required dropdowns are selected
          if (!selectedPlatform) return i.reply({ content: '❌ Please select a platform before sending.', ephemeral: true });
          if (!selectedSport) return i.reply({ content: '❌ Please select a sport before sending.', ephemeral: true });
          if (!selectedBetType) return i.reply({ content: '❌ Please select a bet type before sending.', ephemeral: true });

          // Create the modal for detailed input
          const modal = new ModalBuilder()
            .setCustomId('betslip_details_modal')
            .setTitle('Enter Betslip Details')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('game_name')
                  .setLabel('Game/Event Name')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('units')
                  .setLabel('Units (e.g., 1.5, 2)')
                  .setPlaceholder('Enter a positive number (e.g., 1.5, 2)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('americanOdds')
                  .setLabel('American Odds (e.g., +150, -200)')
                  .setPlaceholder('Enter positive or negative odds')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('betslipLink')
                  .setLabel('Optional: Betslip Link')
                  .setPlaceholder('Enter a valid URL (e.g., https://example.com/betslip)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(false) // Link is optional
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('description')
                  .setLabel('Description of the Bet')
                  .setPlaceholder('Explain your pick (e.g., "Team A ML vs Team B - Reason for the pick")')
                  .setStyle(TextInputStyle.Paragraph) // Longer input field
                  .setRequired(true)
              )
            );

          await i.showModal(modal); // Show the modal to the user
          componentCollector.stop(); // Stop the component collector as we're moving to modal
          attachmentCollector.stop(); // Stop attachment collector too
        }
      }
    });

    // Handle modal submission
    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        filter: i => i.user.id === userId && i.customId === 'betslip_details_modal',
        time: 5 * 60 * 1000, // 5 minutes timeout for modal submission
      });

      // Extract values from modal inputs
      const fields = {
        game_name: modalInteraction.fields.getTextInputValue('game_name').trim(),
        units: modalInteraction.fields.getTextInputValue('units').trim(),
        americanOdds: modalInteraction.fields.getTextInputValue('americanOdds').trim(),
        betslipLink: modalInteraction.fields.getTextInputValue('betslipLink').trim(),
        description: modalInteraction.fields.getTextInputValue('description').trim()
      };

      // Validate modal inputs
      const units = parseFloat(fields.units);
      const decimalOdds = convertAmericanToDecimal(fields.americanOdds);

      if (isNaN(units) || units <= 0) {
        return modalInteraction.reply({ content: '❌ Units must be a positive number.', ephemeral: true });
      }
      if (!/^[-+]?\d+$/.test(fields.americanOdds) || fields.americanOdds === '0' || !decimalOdds || decimalOdds <= 1) {
        return modalInteraction.reply({ content: '❌ Invalid American odds. Please enter a valid number (e.g., +150 or -200) and ensure it converts to valid decimal odds.', ephemeral: true });
      }

      // Validate betslip link format if provided
      const finalBetslipLink = (fields.betslipLink && fields.betslipLink.startsWith('http')) ? fields.betslipLink : null;
      if (fields.betslipLink && !finalBetslipLink) {
          return modalInteraction.reply({ content: '❌ Provided betslip link is not a valid URL (must start with http/https).', ephemeral: true });
      }


      // Create a preview embed for confirmation
      const previewEmbed = new EmbedBuilder()
        .setTitle(`**${fields.game_name}**`)
        .setColor('#AC3C49')
        .setDescription(fields.description)
        .addFields(
          { name: 'Units', value: units.toString(), inline: true },
          { name: 'Odds', value: fields.americanOdds, inline: true },
          { name: 'Platform', value: selectedPlatform, inline: true },
          { name: 'Sport', value: selectedSport, inline: true },
          { name: 'Bet Type', value: selectedBetType, inline: true },
        )
        .setFooter({ text: 'Please confirm to post this betslip.' });

      if (uploadedImageUrl) previewEmbed.setImage(uploadedImageUrl);


      // Confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_betslip')
        .setLabel('✅ Confirm')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_betslip')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      // Reply with the preview embed and confirmation buttons (ephemeral)
      await modalInteraction.reply({ embeds: [previewEmbed], components: [actionRow], ephemeral: true });

      // Wait for confirmation from the user
      const confirmation = await modalInteraction.channel.awaitMessageComponent({
        filter: i => i.user.id === userId && ['confirm_betslip', 'cancel_betslip'].includes(i.customId),
        time: 2 * 60 * 1000, // 2 minutes timeout for confirmation
      });

      // Handle cancellation after preview
      if (confirmation.customId === 'cancel_betslip') {
        await confirmation.update({ content: '❌ Betslip creation cancelled.', components: [], embeds: [] });
        return;
      }

      // If confirmed, defer update to show processing
      if (confirmation.customId === 'confirm_betslip') {
        await confirmation.deferUpdate(); // Acknowledge the button click

        const user = interaction.user;
        const avatarURL = user.displayAvatarURL({ dynamic: true });

        // Final embed to be sent to the plays channel
        const betEmbed = new EmbedBuilder()
          .setColor('#AC3C49')
          .setAuthor({ name: `Bet slip by ${user.username}`, iconURL: avatarURL })
          .setDescription(`${fields.description}\n\n**Units | ${units}**`)
          .setTimestamp();

        if (uploadedImageUrl) betEmbed.setImage(uploadedImageUrl);

        // Grade buttons (Win, Push, Loss)
        const gradeButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('win').setLabel('🟢 WIN').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('push').setLabel('⚪ PUSH').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('loss').setLabel('🔴 LOSS').setStyle(ButtonStyle.Danger),
        );

        // Fetch the designated logs channel
        const settings = await Settings.findOne({ guildId: interaction.guild.id });
        const logsChannel = settings && interaction.guild.channels.cache.get(settings.logsChannelId);

        if (!logsChannel) {
          await modalInteraction.followUp({
            content: '❌ Error: No plays channel has been set up for this server. Please use `/setupplayschannel` first.',
            ephemeral: true
          });
          // Cleanup original ephemeral reply
          await interaction.editReply({ content: '❌ Betslip creation failed: Plays channel not set.', components: [], embeds: [] });
          return;
        }

        // Add optional "Place The Bet" button if a link is provided
        let betslipButtonRow = null;
        if (finalBetslipLink) {
          // Custom emoji IDs (replace with your server's emoji IDs or use unicode)
          const platformEmojis = {
            'Stake': '<:stake:1377747916017369228>', // Example: Replace 137... with actual ID
            'Fanduel': '<:fanduel:1377748884461322392>',
            'Bet365': '<:bet365:1377748887191949413>',
            'PrizePicks': '<:prizepicks:1377747315229462690>',
          };
          const emojiString = platformEmojis[selectedPlatform] || '🔗'; // Fallback to link emoji

          const betslipButton = new ButtonBuilder()
            .setLabel(`Place The Bet On ${selectedPlatform}`)
            .setStyle(ButtonStyle.Link)
            .setURL(finalBetslipLink)
            .setEmoji(emojiString); // Add emoji to button

          betslipButtonRow = new ActionRowBuilder().addComponents(betslipButton);
        }

        // Construct the message payload (embeds and components)
        const messagePayload = { embeds: [betEmbed] };
        if (betslipButtonRow) {
          messagePayload.components = [betslipButtonRow, gradeButtons]; // Add both rows
        } else {
            messagePayload.components = [gradeButtons]; // Only grade buttons if no betslip link
        }


        // Send the final betslip embed to the designated plays channel
        const betMessage = await logsChannel.send(messagePayload);

        // Save betslip details to the database
        await Betslip.create({
          capperId: userId,
          guildId: guildId, // Store guildId with betslip
          messageId: betMessage.id, // Store the ID of the sent message for future grading
          platform: selectedPlatform,
          sport: selectedSport,
          betType: selectedBetType,
          title: fields.game_name,
          units,
          americanOdds: fields.americanOdds,
          decimalOdds,
          betslipLink: finalBetslipLink,
          description: fields.description,
          imageUrl: uploadedImageUrl,
          createdAt: new Date(),
          status: 'pending', // Initial status
        });

        // Inform the user that the betslip was posted
        await modalInteraction.followUp({ content: '✅ Betslip posted successfully!', ephemeral: true });
        // Cleanup the initial ephemeral reply
        await interaction.editReply({ content: '✅ Betslip creation complete.', components: [], embeds: [] });

      }
    } catch (error) {
      console.error('Error during betslip creation process:', error);
      // Handle timeout or other errors during modal/confirmation
      if (error.code === 'INTERACTION_COLLECTOR_ERROR' || error.code === 'MODAL_SUBMIT_INTERACTION_TIMEOUT') {
         await interaction.editReply({ content: '⌛ Betslip creation timed out or cancelled.', components: [], embeds: [] });
      } else {
         await interaction.editReply({ content: '❌ An unexpected error occurred during betslip creation. Please try again.', components: [], embeds: [] });
      }
    }
  },
};
