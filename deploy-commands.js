// deploy-commands.js

// Load environment variables from .env file
require('dotenv').config();

// Import necessary Discord.js modules
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Array to hold command data for deployment
const commands = [];
// Path to the commands directory
const commandsPath = path.join(__dirname, 'commands');
// Read all JavaScript files from the commands directory
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Loop through each command file and add its data to the commands array
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Ensure the command has both 'data' (SlashCommandBuilder) and 'execute' properties
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON()); // Convert SlashCommandBuilder data to JSON
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// --- Deploy Commands ---
(async () => {
    try {
        const CLIENT_ID = process.env.CLIENT_ID;
        // const GUILD_ID = process.env.GUILD_ID; // Only needed for guild-specific deletion/deployment

        console.log('Attempting to delete all existing global application (/) commands...');

        // 1. Delete all existing GLOBAL commands
        // By passing an empty array to Routes.applicationCommands(CLIENT_ID),
        // you are telling Discord to replace all existing global commands with an empty set.
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [] },
        );
        console.log('Successfully deleted all existing global application (/) commands.');

        // You can uncomment the following block if you also want to delete guild-specific commands
        // for a specific guild before deploying globally. This is generally not needed if you
        // are strictly moving to global commands.
        /*
        if (GUILD_ID) {
            console.log(`Attempting to delete all existing guild-specific application (/) commands for guild ${GUILD_ID}...`);
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: [] },
            );
            console.log(`Successfully deleted all existing guild-specific application (/) commands for guild ${GUILD_ID}.`);
        }
        */

        console.log(`Started refreshing ${commands.length} new global application (/) commands.`);

        // 2. Deploy the new global commands
        // This will deploy the commands collected from your 'commands' directory globally.
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} new global application (/) commands.`);
    } catch (error) {
        // Catch and log any errors during deployment
        console.error('Error during command deployment:', error);
    }
})();