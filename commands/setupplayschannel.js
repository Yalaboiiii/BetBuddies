// commands/setupplayschannel.js

const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const Settings = require('../models/Settings'); // Adjusted to use the new Settings model

module.exports = {
  // Define the slash command data
  data: new SlashCommandBuilder()
    .setName('setupplayschannel')
    .setDescription('Sets the channel where plays/betslip updates will be sent.')
    .addChannelOption(option => // Option to select a channel
      option.setName('channel')
        .setDescription('The text channel to set for plays/betslip updates.')
        .addChannelTypes(ChannelType.GuildText) // Restrict to text channels only
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels), // Only users with Manage Channels permission can use this

  // Execute function for the command
  async execute(interaction) {
    const guildId = interaction.guildId; // Get the ID of the guild
    const selectedChannel = interaction.options.getChannel('channel'); // Get the selected channel object

    // Ensure the command is used in a guild
    if (!guildId) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#AC3C49')
        .setDescription('🚫 **Command Restricted** | This command can only be used within a Discord server.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      // Find or create the guild's settings document
      let guildSettings = await Settings.findOne({ guildId: guildId });

      if (guildSettings) {
        // If settings exist, update the logsChannelId
        guildSettings.logsChannelId = selectedChannel.id;
      } else {
        // If settings don't exist, create a new one
        guildSettings = new Settings({
          guildId: guildId,
          logsChannelId: selectedChannel.id,
        });
      }

      // Save the updated/new configuration to the database
      await guildSettings.save();

      const successEmbed = new EmbedBuilder()
        .setColor('#AC3C49')
        .setDescription(`✅ | Play channel set to ${selectedChannel}! All plays and betslip updates will now be sent there.`);

      await interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error setting plays channel:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#AC3C49')
        .setDescription('❌ **Error** | An unexpected error occurred while setting the plays channel. Please try again.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
