// models/Capper.js

const mongoose = require('mongoose');

// Define the schema for a Capper
const capperSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    description: 'The Discord server (guild) ID where this capper is registered.'
  },
  userId: {
    type: String,
    required: true,
    description: 'The Discord user ID of the capper.'
  },
  username: {
    type: String,
    required: true,
    description: 'The Discord username of the capper at the time of registration or last update.'
  },
  wins: {
    type: Number,
    default: 0,
    description: 'The number of bets won by this capper.'
  },
  losses: {
    type: Number,
    default: 0,
    description: 'The number of bets lost by this capper.'
  },
  pushes: {
    type: Number,
    default: 0,
    description: 'The number of bets that resulted in a push (tie) for this capper.'
  },
  // You can add more fields here as needed, for example:
  // totalBets: { type: Number, default: 0 },
  // profitLoss: { type: Number, default: 0 },
  // lastBetDate: { type: Date, default: Date.now }
});

// Add a compound unique index to ensure that a user can only be a capper once per guild.
capperSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Export the Capper model
module.exports = mongoose.model('Capper', capperSchema);
