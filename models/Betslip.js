// models/Betslip.js

const mongoose = require('mongoose');

const betslipSchema = new mongoose.Schema({
  capperId: {
    type: String,
    required: true,
    description: 'The Discord user ID of the capper who created the betslip.'
  },
  guildId: { // Added guildId to betslip for easy per-server filtering
    type: String,
    required: true,
    description: 'The Discord server (guild) ID where the betslip was posted.'
  },
  messageId: {
    type: String,
    required: true,
    unique: true, // Each betslip message in Discord should have a unique ID
    description: 'The Discord message ID of the posted betslip (for grading).'
  },
  platform: {
    type: String,
    required: true,
    description: 'The betting platform used (e.g., Stake, Fanduel).'
  },
  sport: {
    type: String,
    required: true,
    description: 'The sport of the bet.'
  },
  betType: {
    type: String,
    required: true,
    description: 'The type of bet (e.g., Money Line, Parlay).'
  },
  title: {
    type: String,
    required: true,
    description: 'The game/event name for the betslip.'
  },
  units: {
    type: Number,
    required: true,
    description: 'The number of units wagered.'
  },
  americanOdds: {
    type: String,
    required: true,
    description: 'The American odds (e.g., +150, -200).'
  },
  decimalOdds: {
    type: Number,
    required: true,
    description: 'The converted decimal odds.'
  },
  betslipLink: {
    type: String,
    default: null,
    description: 'Optional link to the actual betslip on the platform.'
  },
  description: {
    type: String,
    required: true,
    description: 'A detailed description of the bet.'
  },
  imageUrl: {
    type: String,
    default: null,
    description: 'Optional URL of the betslip image attachment.'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when the betslip was created.'
  },
  status: {
    type: String,
    default: 'pending', // Can be 'pending', 'win', 'loss', 'push'
    enum: ['pending', 'win', 'loss', 'push'],
    description: 'The current status of the betslip.'
  },
  gradedBy: {
    type: String,
    default: null,
    description: 'The Discord user ID of the person who graded the betslip.'
  },
  gradedAt: {
    type: Date,
    default: null,
    description: 'Timestamp when the betslip was graded.'
  }
});

// Export the Betslip model
module.exports = mongoose.model('Betslip', betslipSchema);
