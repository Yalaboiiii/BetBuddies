const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot’s latency and stats!'),

  async execute(interaction) {
    // Send initial reply and measure latency
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    // Format uptime
    const totalSeconds = Math.floor(interaction.client.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    // Get Node.js version
    const nodeVersion = process.version;

    // Get MongoDB connection status (optional)
    let mongoStatus = '❌ Disconnected';
    try {
      const mongoose = require('mongoose');
      const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
      if (mongoose.connection?.readyState !== undefined) {
        mongoStatus = `✅ ${states[mongoose.connection.readyState]}`;
      }
    } catch {
      mongoStatus = '❓ Unknown (mongoose not found)';
    }

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('📡 Bot Latency & Stats')
      .setColor('#8e44ad')
      .setDescription(
        `Here’s the current status of the bot ⚡\n\n` +
        `- **API Latency**: \`${apiLatency}ms\`\n` +
        `- **Command Latency**: \`${latency}ms\`\n` +
        `- **Node.js Version**: \`${nodeVersion}\`\n` +
        `- **MongoDB Connection**: ${mongoStatus}\n` +
        `- **Uptime**: \`${uptime}\`\n`
      )
      .setTimestamp();

    // Edit the original reply
    await interaction.editReply({ content: ' ', embeds: [embed] });
  },
};
