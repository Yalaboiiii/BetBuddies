// commands/removecapper.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // Import EmbedBuilder
const Capper = require('../models/Capper'); // Adjust path if your models folder is different

module.exports = {
  // Define the slash command data
  data: new SlashCommandBuilder()
    .setName('removecapper')
    .setDescription('Removes a capper from the server.')
    .addUserOption(option => // Option for selecting a Discord user
      option.setName('user')
        .setDescription('The Discord user to remove as a capper.')
        .setRequired(true)), // This option is mandatory

  // Execute function for the command
  async execute(interaction) {
    const guildId = interaction.guildId; // Get the ID of the guild (server)
    const targetUser = interaction.options.getUser('user'); // Get the user object

    // Ensure the command is used in a guild
    if (!guildId) {
      // Create an ephemeral embed for errors in DMs
      const errorEmbed = new EmbedBuilder()
        .setColor('#AC3C49') // Updated color
        .setDescription('🚫 **Command Restricted** | This command can only be used within a Discord server.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      // Attempt to delete the capper from the database for the specific guild
      const result = await Capper.deleteOne({ guildId: guildId, userId: targetUser.id });

      // If no capper was found and deleted
      if (result.deletedCount === 0) {
        const notFoundEmbed = new EmbedBuilder()
          .setColor('#AC3C49') // Updated color
          .setDescription(`⚠️ **${targetUser.username}** is not a capper in this server.`);
        return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
      }

      // If successfully deleted
      const successEmbed = new EmbedBuilder()
        .setColor('#AC3C49') // Updated color
        .setDescription(`✅ | **${targetUser.username}** has been removed as a capper.`);
      await interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error removing capper:', error);
      // Create an embed for general errors
      const errorEmbed = new EmbedBuilder()
        .setColor('#AC3C49') // Updated color
        .setDescription('❌ **Error** | An unexpected error occurred while removing the capper. Please try again.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
