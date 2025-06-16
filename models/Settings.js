// models/Settings.js

const mongoose = require('mongoose');

// Define the schema for Guild-specific Settings
const settingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true, // Ensures only one settings document per guild
    description: 'The Discord server (guild) ID.'
  },
  logsChannelId: { // Renamed from playsChannelId to logsChannelId to match betslip command
    type: String,
    default: null, // Default to null if no channel is set
    description: 'The ID of the channel designated for betslips/plays or general bot logs.'
  },
  // Add other guild-specific configuration fields here as needed
});

// Export the Settings model
module.exports = mongoose.model('Settings', settingsSchema);
