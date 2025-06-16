// commands/help.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  // Define the slash command data with an updated description
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands and provides support information.'),

  // Execute function for the command
  async execute(interaction) {
    // Get the path to the current directory (commands folder)
    const commandsPath = path.join(__dirname);
    // Read all JavaScript files in the commands folder, excluding this help.js file itself
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Define emojis for each command for a clear visual distinction
    const commandEmojis = {
      'addcapper': '<:1000051291839545454:1384050975840403488>',
      'removecapper': '<:1000051291839545454:1384050975840403488>',
      'capperstats': '<:1000051291839545454:1384050975840403488>',
      'betslip': '<:1000051291839545454:1384050975840403488>',
      'ping': '<:1000051291839545454:1384050975840403488>',
      'setupplayschannel': '<:1000051291839545454:1384050975840403488>', // Added emoji for the new command
      'help': '<:1000051291839545454:1384050975840403488>'
    };

    let commandFields = []; // Array to hold fields for each command
    // Iterate through each command file to get its name, description, and assign an emoji
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      // Ensure the command has valid data (from SlashCommandBuilder)
      if (command.data) {
        const emoji = commandEmojis[command.data.name] || '📄'; // Default emoji if not found
        commandFields.push({
          name: `${emoji} | \`/${command.data.name}\``, // Added specific emoji and pipe separator
          value: command.data.description,    // Display the command's description
          inline: false // Ensure each command appears on its own line in the embed fields
        });
      }
    }

    // Create the main embed for the help message
    const helpEmbed = new EmbedBuilder()
      .setColor('#AC3C49') // Using the same color as your previous request for consistency
      .setTitle('Bet Buddies Bot Commands') // More engaging title with emojis
      .setDescription(
        'Welcome to Bet Buddies! 🎉 I\'m here to help you manage capper statistics and bet slips efficiently for your server. Below is a list of my available commands:'
      )
      .addFields(
        // Add command fields, or a message if no commands are found
        commandFields.length > 0
          ? commandFields
          : { name: 'No Commands Found', value: 'It seems there are no commands available yet. Please contact the bot administrator.' }
      )
      // Added bot icon and name to the author field
      .setAuthor({
          name: interaction.client.user.username, // Your bot's username
          iconURL: interaction.client.user.displayAvatarURL() // Your bot's avatar
      })
      .setTimestamp(); // Add a timestamp for when the help message was generated

    // Create the "Invite" button
    const inviteButton = new ButtonBuilder()
      .setLabel('Invite') // Label for the invite button
      .setEmoji('<:emoji:1384050977941749830>')
      .setURL('https://discord.com/api/oauth2/authorize?client_id=1384053971399737414&permissions=YOUR_PERMISSION_INTEGER&scope=bot%20applications.commands') // Your bot's invite link
      .setStyle(ButtonStyle.Link);

    // Create the "Support" button
    const supportButton = new ButtonBuilder()
      .setLabel('Server') // Label displayed on the button
      .setEmoji('<:emoji:1384050977941749830>')
      .setURL('https://discord.gg/w9yaBpPaRM')      // The Discord invite link
      .setStyle(ButtonStyle.Link);

    // Create an ActionRow to hold both buttons
    const row = new ActionRowBuilder()
      .addComponents(inviteButton, supportButton); // Add both buttons to the row

    // Reply to the interaction with the embed and the button row.
    // Set ephemeral to false so the help message and button are visible to everyone in the channel.
    await interaction.reply({ embeds: [helpEmbed], components: [row], ephemeral: false });
  },
};
