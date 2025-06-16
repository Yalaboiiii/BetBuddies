// commands/addcapper.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Capper = require('../models/Capper'); // Adjust path if your models folder is different

module.exports = {
  // Define the slash command data
  data: new SlashCommandBuilder()
    .setName('addcapper')
    .setDescription('Adds a new capper to the server.')
    .addUserOption(option => // Option for selecting a Discord user
      option.setName('user')
        .setDescription('The Discord user to add as a capper.')
        .setRequired(true)), // This option is mandatory

  // Execute function for the command
  async execute(interaction) {
    const guildId = interaction.guildId; // Get the ID of the guild (server) where the command was used
    const targetUser = interaction.options.getUser('user'); // Get the user object provided in the option

    // Ensure the command is used in a guild
    if (!guildId) {
      // Create an ephemeral embed for errors in DMs
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red color for error
        .setDescription('🚫 **Command Restricted** | This command can only be used within a Discord server.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      // Try to find if the user is already registered as a capper in this guild
      let capper = await Capper.findOne({ guildId: guildId, userId: targetUser.id });

      // If capper already exists, inform the user with a simple embed
      if (capper) {
        const existingCapperEmbed = new EmbedBuilder()
          .setColor(0xFFA500) // Orange color for warning
          .setDescription(`⚠️ **${targetUser.username}** is already a capper! | Wins: ${capper.wins} | Losses: ${capper.losses}`);
        return interaction.reply({ embeds: [existingCapperEmbed], ephemeral: true }); // Ephemeral so only the user sees it
      }

      // If not found, create a new capper entry
      capper = new Capper({
        guildId: guildId,
        userId: targetUser.id,
        username: targetUser.username, // Store the username for easier display
        wins: 0,
        losses: 0,
        pushes: 0,
      });

      // Save the new capper to the database
      await capper.save();

      // Create a success embed for the newly added capper
      const successEmbed = new EmbedBuilder()
        .setColor(`#AC3C49`)
        .setDescription(`✅ | **${targetUser.username}** added as capper!\n **Initial Stats:** W : \`0\` | L: \`0\` | P: \`0\``);

      // Reply with the success embed
      await interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error adding capper:', error);
      // Create an embed for general errors
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red color for error
        .setDescription('❌ **Error** | An unexpected error occurred while adding the capper. Please try again.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
