// index.js

// Load environment variables from .env file
require('dotenv').config();

// Import necessary Discord.js and Mongoose modules
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

// Import your Mongoose models
const Capper = require('./models/Capper');
const Betslip = require('./models/Betslip');
const Settings = require('./models/Settings');

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Required to fetch member information for grading permissions
  ],
});

// Create a Collection to store your commands
client.commands = new Collection();

// --- Command Loading ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// --- Event Handlers ---

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  // --- Handle Slash Commands ---
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }

  // --- Handle Button Interactions (for Betslip Grading) ---
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const allowedGradeActions = ['win', 'push', 'loss'];

    if (allowedGradeActions.includes(customId)) {
      await interaction.deferReply({ ephemeral: true }); // Defer reply to prevent "This interaction failed"

      const betslipMessageId = interaction.message.id;
      const graderUserId = interaction.user.id;
      const guildId = interaction.guildId;

      try {
        const betslip = await Betslip.findOne({ guildId: guildId, messageId: betslipMessageId });

        if (!betslip) {
          return await interaction.editReply({ content: '❌ Betslip not found in the database.' });
        }

        if (betslip.status !== 'pending') {
          return await interaction.editReply({ content: `⚠️ This betslip has already been graded as **${betslip.status.toUpperCase()}**.` });
        }

        const member = interaction.member;
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (graderUserId !== betslip.capperId && !isAdmin) {
          return await interaction.editReply({ content: '❌ Only the capper who posted this betslip or an administrator can grade it.' });
        }

        // Update capper stats based on the outcome
        const capperStats = await Capper.findOne({ guildId: guildId, userId: betslip.capperId });
        if (capperStats) {
          if (customId === 'win') {
            capperStats.wins++;
          } else if (customId === 'loss') {
            capperStats.losses++;
          } else if (customId === 'push') {
            capperStats.pushes++;
          }
          await capperStats.save();
        } else {
          console.warn(`Capper ${betslip.capperId} not found for stat update.`);
        }

        // Update betslip status and grader info
        betslip.status = customId;
        betslip.gradedBy = graderUserId;
        betslip.gradedAt = new Date();
        await betslip.save();

        // --- Start of Fix: Preserve Original Embed Content ---
        const currentEmbedData = interaction.message.embeds[0].toJSON(); // Get the raw JSON data of the existing embed

        // Ensure description is a string before appending
        const originalDescription = currentEmbedData.description || '';

        const updatedEmbed = new EmbedBuilder()
          .setColor(
            customId === 'win' ? 0x00FF00 : // Green for win
            customId === 'loss' ? 0xFF0000 : // Red for loss
            0xFFA500 // Orange for push
          )
          .setAuthor(currentEmbedData.author || null) // Preserve author
          .setDescription(`${originalDescription}\n\n**Outcome: ${customId.toUpperCase()}!**`) // Append outcome
          // Fix: Convert the timestamp string to a Date object
          .setTimestamp(currentEmbedData.timestamp ? new Date(currentEmbedData.timestamp) : null)
          .setImage(currentEmbedData.image ? currentEmbedData.image.url : null) // Preserve image
          .setFooter({ text: `Graded by ${interaction.user.username} at ${new Date().toLocaleString()}` });

        // Add original fields back if they exist
        if (currentEmbedData.fields && currentEmbedData.fields.length > 0) {
            updatedEmbed.addFields(currentEmbedData.fields);
        }
        // --- End of Fix ---

        // Disable all buttons after grading
        const disabledComponents = interaction.message.components.map(row => {
          const newRow = row.toJSON();
          newRow.components = newRow.components.map(component => {
            component.disabled = true;
            return component;
          });
          return newRow;
        });

        await interaction.message.edit({ embeds: [updatedEmbed], components: disabledComponents });

        await interaction.editReply({ content: `✅ Betslip successfully graded as **${customId.toUpperCase()}**!` });

      } catch (error) {
        console.error('Error grading betslip:', error);
        await interaction.editReply({ content: '❌ An error occurred while trying to grade the betslip.' });
      }
    }
  }
});

// --- Bot Login ---
client.login(process.env.DISCORD_TOKEN);
