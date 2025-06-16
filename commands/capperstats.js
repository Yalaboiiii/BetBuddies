// commands/cappersstats.js

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Betslip = require('../models/Betslip'); // Adjusted path
const Capper = require('../models/Capper');   // Adjusted path
const moment = require('moment'); // Import moment.js for date handling

// --- Date References for filtering ---
// These helpers define the start of various time periods.
const today = moment().startOf('day');
const yesterday = moment().subtract(1, 'day').startOf('day');
const sevenDaysAgo = moment().subtract(7, 'days').startOf('day');
const monthStart = moment().startOf('month');
const yearStart = moment().startOf('year');

// --- Helper function to calculate statistics for a given array of bets ---
function calculateStats(bets) {
    let profit = 0;       // Total profit in units
    let wins = 0;         // Number of wins
    let losses = 0;       // Number of losses
    let pushes = 0;       // Number of pushes (ties)
    let unitsRisked = 0;  // Total units risked for ROI calculation

    // Iterate through each bet to calculate stats
    for (const bet of bets) {
        // Only consider graded bets for profit/loss calculation and units risked
        if (['win', 'loss', 'push'].includes(bet.status)) {
            unitsRisked += bet.units; // Accumulate units risked

            if (bet.status === 'win' && bet.decimalOdds && bet.units) {
                // Profit for a win = units * (decimal_odds - 1)
                profit += bet.units * (bet.decimalOdds - 1);
                wins++;
            } else if (bet.status === 'loss' && bet.units) {
                // Loss = units risked
                profit -= bet.units;
                losses++;
            } else if (bet.status === 'push') {
                pushes++;
                // Profit remains unchanged for a push
            }
        }
    }

    const totalDecidedBets = wins + losses; // Bets that have a clear win or loss outcome
    // Calculate Win Rate: (Wins / Total Decided Bets) * 100
    const winRate = totalDecidedBets > 0 ? (wins / totalDecidedBets) * 100 : 0;
    // Calculate ROI: (Profit / Units Risked) * 100
    const roi = unitsRisked > 0 ? (profit / unitsRisked) * 100 : 0;

    return {
        profit: +profit.toFixed(2), // Fix profit to 2 decimal places
        wins,
        losses,
        pushes,
        total: bets.length, // Total number of bets (including pending)
        winRate: +winRate.toFixed(2), // Fix win rate to 2 decimal places
        roi: +roi.toFixed(2)          // Fix ROI to 2 decimal places
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('capperstats') // Renamed to 'capperstats' for consistency with previous discussion
        .setDescription('Show detailed stats for all cappers or a specific capper.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Only administrators can use this command
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Select a specific capper to view their detailed stats.')
                .setRequired(false) // This option is optional
        )
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period for the selected capper\'s stats.')
                .addChoices(
                    { name: 'Today', value: 'today' },
                    { name: 'Yesterday', value: 'yesterday' },
                    { name: 'Last 7 Days', value: '7days' },
                    { name: 'This Month', value: 'month' },
                    { name: 'Year to Date', value: 'year' },
                    { name: 'All Time', value: 'alltime' }
                )
                .setRequired(false) // This option is optional
        ),

    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply as fetching data can take time

        const guildId = interaction.guildId; // Get the guild ID for server-specific data
        const targetUser = interaction.options.getUser('target');
        const periodOption = interaction.options.getString('period');

        // --- Individual Capper Stats ---
        if (targetUser) {
            const capper = await Capper.findOne({ guildId: guildId, userId: targetUser.id });
            if (!capper) {
                return interaction.editReply({ content: `❌ No capper data found for **${targetUser.username}** in this server.` });
            }

            // Fetch all bets for the target capper in this guild
            let allCapperBets = await Betslip.find({ guildId: guildId, capperId: targetUser.id }).sort({ createdAt: -1 }); // Sort by newest first
            if (!allCapperBets.length) {
                return interaction.editReply({ content: `❌ No bets found for **${targetUser.username}** in this server.` });
            }

            let periodName = 'All Time';
            let filteredBetsForPeriod = allCapperBets;

            // Filter bets based on the selected time period
            if (periodOption) {
                switch (periodOption) {
                    case 'today':
                        filteredBetsForPeriod = allCapperBets.filter(bet => moment(bet.createdAt).isSame(today, 'day'));
                        periodName = 'Today';
                        break;
                    case 'yesterday':
                        filteredBetsForPeriod = allCapperBets.filter(bet => moment(bet.createdAt).isSame(yesterday, 'day'));
                        periodName = 'Yesterday';
                        break;
                    case '7days':
                        filteredBetsForPeriod = allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(sevenDaysAgo));
                        periodName = 'Last 7 Days';
                        break;
                    case 'month':
                        filteredBetsForPeriod = allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(monthStart));
                        periodName = 'This Month';
                        break;
                    case 'year':
                        filteredBetsForPeriod = allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(yearStart));
                        periodName = 'Year to Date';
                        break;
                    case 'alltime':
                    default:
                        periodName = 'All Time';
                        break;
                }
            }

            // Check if there are bets for the filtered period
            if (!filteredBetsForPeriod.length && periodOption !== 'alltime') {
                return interaction.editReply({ content: `❌ No bets found for **${targetUser.username}** within the **${periodName}** period.` });
            }

            const stats = calculateStats(filteredBetsForPeriod); // Main stats for the chosen period
            // Calculate historical stats for display
            const statsYesterday = calculateStats(allCapperBets.filter(bet => moment(bet.createdAt).isSame(yesterday, 'day')));
            const stats7Days = calculateStats(allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(sevenDaysAgo)));
            const statsThisMonth = calculateStats(allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(monthStart)));
            const statsYTD = calculateStats(allCapperBets.filter(bet => moment(bet.createdAt).isSameOrAfter(yearStart)));
            const statsAllTime = calculateStats(allCapperBets);

            // Determine embed color based on profit
            const profitColor = stats.profit > 0 ? '#AC3C49' : (stats.profit < 0 ? '#AC3C49' : '#AC3C49'); // Green for profit, Red for loss, Grey for no change

            const maxRecentBets = 10; // Limit the number of recent bets to display in the table
            const recentBetLines = filteredBetsForPeriod.slice(0, maxRecentBets)
                .map(bet => {
                    const title = bet.title.length > 20 ? bet.title.slice(0, 17) + '...' : bet.title.padEnd(20);
                    const units = bet.units.toFixed(1).padStart(5); // Format units
                    const odds = bet.americanOdds.padStart(7); // Keep original odds format
                    const resultEmoji = { 'win': '✅', 'loss': '❌', 'push': '➖', 'pending': '⏳' };
                    const statusEmoji = resultEmoji[bet.status || 'pending'];
                    const date = moment(bet.createdAt).format('MM/DD'); // Format date
                    return `\`${date}\` | \`${title}\` | \`${units}\`U | \`${odds}\` | ${statusEmoji}`;
                }).join('\n');

            const betsTable = recentBetLines.length > 0 ?
                `**Recent Bets (${periodName}):**\n\`\`\`asciidoc\n[Date] | [Title]             | [Units] | [Odds]  | [Result]\n---------------------------------------------------------------\n${recentBetLines}${filteredBetsForPeriod.length > maxRecentBets ? `\n...and ${filteredBetsForPeriod.length - maxRecentBets} more bets.` : ''}\n\`\`\``
                : `_No recent bets found for ${targetUser.username} within the **${periodName}** period._`;


            const embed = new EmbedBuilder()
                .setTitle(`📊 ${capper.username || targetUser.tag} - Bets Overview (${periodName})`)
                .setColor(profitColor)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true })) // Show capper's avatar
                .addFields(
                    { name: 'Summary', value: `**Total Bets:** ${stats.total}\n**Wins:** ${stats.wins}\n**Losses:** ${stats.losses}\n**Pushes:** ${stats.pushes}`, inline: true },
                    { name: 'Performance', value: `**Profit:** ${stats.profit} units\n**Win Rate:** ${stats.winRate}%\n**ROI:** ${stats.roi}%`, inline: true },
                    { name: 'Historical Profit (Units)', value: `**Yesterday:** \`${statsYesterday.profit}\`\n**Last 7 Days:** \`${stats7Days.profit}\`\n**This Month:** \`${statsThisMonth.profit}\`\n**YTD:** \`${statsYTD.profit}\`\n**All Time:** \`${statsAllTime.profit}\``, inline: true }
                )
                // Using a placeholder image for visual separation. Remove if not desired.
                .setImage(`https://media.discordapp.net/attachments/1113081965525094452/1218951663562526720/Comp_1.gif?ex=683a7e73&is=68392cf3&hm=066c7e2f1bbd7c98b59d9c8ba346507994f4edb0cdf0fa254bdcde2dd98a44fc&=&width=675&height=14`)
                .setFooter({ text: 'Data calculated based on graded bets.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            // Send the bets table as a follow-up message to keep the embed clean
            await interaction.followUp({ content: betsTable, ephemeral: false });
            return;
        }

        // --- Overall Server Stats (if no target user is specified) ---
        const allCappers = await Capper.find({ guildId: guildId }) || [];
        if (!allCappers.length) {
            return interaction.editReply({ content: '❌ No cappers found in this server yet.' });
        }

        const allGuildBets = await Betslip.find({ guildId: guildId, status: { $in: ['win', 'loss', 'push'] } }) || []; // Only graded bets for global stats
        const globalStats = calculateStats(allGuildBets);

        const globalEmbed = new EmbedBuilder()
            .setTitle('🌐 Server Overall Stats')
            .setColor(globalStats.profit > 0 ? '#AC3C49' : (globalStats.profit < 0 ? '#AC3C49' : '#AC3C49'))
            .setDescription(
                `A summary of all graded bets across the server.\n\n` +
                `**Total Graded Bets:** \`${globalStats.total}\`\n` +
                `**Wins:** \`${globalStats.wins}\` | **Losses:** \`${globalStats.losses}\` | **Pushes:** \`${globalStats.pushes}\`\n` +
                `**Total Profit:** \`${globalStats.profit}\` units\n` +
                `**Win Rate:** \`${globalStats.winRate}%\`\n` +
                `**ROI:** \`${globalStats.roi}%\``
            )
            .setFooter({ text: 'To see individual capper stats, use /capperstats @User' })
            .setTimestamp();

        // Prepare the capper leaderboard table
        const capperLines = allCappers.map(capper => {
            const capperBets = allGuildBets.filter(bet => bet.capperId === capper.userId);
            if (!capperBets.length) return null; // Skip cappers with no graded bets

            const stats = calculateStats(capperBets);
            const name = (capper.username || capper.userId).length > 15 ? (capper.username || capper.userId).slice(0, 12) + '...' : (capper.username || capper.userId).padEnd(15);
            const profit = stats.profit.toFixed(1);
            const winRate = stats.winRate.toFixed(0); // Round to whole number for leaderboard
            const roi = stats.roi.toFixed(0); // Round to whole number

            // Format profit with sign and pad
            const formattedProfit = profit > 0 ? `+${profit}` : profit;

            return `${name.padEnd(15)} | ${formattedProfit.padStart(6)}U | ${stats.wins.toString().padStart(3)} | ${stats.losses.toString().padStart(3)} | ${stats.pushes.toString().padStart(3)} | ${stats.total.toString().padStart(3)} | ${winRate.padStart(3)}% | ${roi.padStart(3)}%`;
        }).filter(Boolean); // Filter out nulls (cappers with no graded bets)

        // Sort cappers by profit for the leaderboard
        capperLines.sort((a, b) => {
            const profitA = parseFloat(a.split('|')[1].trim());
            const profitB = parseFloat(b.split('|')[1].trim());
            return profitB - profitA; // Descending order of profit
        });


        const cappersTable = `\`\`\`asciidoc\n[Capper]          | Profit  | W   | L   | P   | Total | WR% | ROI%\n----------------------------------------------------------------------\n${capperLines.join('\n')}\n\`\`\``;


        await interaction.editReply({ embeds: [globalEmbed] });
        await interaction.followUp({ content: cappersTable, ephemeral: false });
    },
};
