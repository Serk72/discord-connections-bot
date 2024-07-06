const {SlashCommandBuilder} = require('discord.js');
const {ConnectionScore} = require('../data/ConnectionScore');
const fetch = require('node-fetch-native');
const {ConnectionGame} = require('../data/ConnectionGame');
const AsciiTable = require('ascii-table');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'ConnectionSummaryCommand.js',
  level: config.get('logLevel'),
});
const FOOTER_MESSAGE = config.get('footerMessage');
const USER_TO_NAME_MAP = config.get('userToNameMap');

/**
 * Command for dispalying summary table for wordle averages.
 */
class ConnectionSummaryCommand {
  static _instance;
  /**
   * Singleton instance.
   * @return {ConnectionSummaryCommand} the singleton instance
   */
  static getInstance() {
    if (!ConnectionSummaryCommand._instance) {
      ConnectionSummaryCommand._instance = new ConnectionSummaryCommand();
    }
    return ConnectionSummaryCommand._instance;
  }
  static data = new SlashCommandBuilder()
      .setName('connectionsummary')
      .setDescription('Displays the current summary (message displated each day)');
    /**
     * Constructor.
     */
  constructor() {
    this.connectionScore = ConnectionScore.getInstance();
    this.connectionGame = ConnectionGame.getInstance();
    this.data = ConnectionSummaryCommand.data;
  }

  /**
   * Asyncronusly gets the url for a gif for the provided connections game.
   * @param {*} latestGame game to find an image of.
   * @return {string} image url to a gif of undefined if none can be retrieved.
   */
  async getImage(latestGame) {
    let imageToSend;
    if (latestGame?.category1 && latestGame?.category1?.trim() !== '') {
      const tenorApiKey = config.get('tenorApiKey');
      if (tenorApiKey) {
        const url = `https://tenor.googleapis.com/v2/search?key=${tenorApiKey}&q=${latestGame?.category1}&limit=1`;
        const response = await fetch(url, {method: 'Get'})
            .then((res) => res?.json())
            .catch((ex) => {
              logger.error(ex);
              return null;
            });
        if (response?.results?.[0]?.media_formats?.gif?.url) {
          imageToSend = response?.results?.[0]?.media_formats?.gif?.url;
        } else {
          logger.error('Giphy Invalid Response.');
          logger.error(response);
        }
      } else {
        const giphyApiKey = config.get('giphyApiKey');
        if (giphyApiKey) {
          const url = `http://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${latestGame?.category1}&limit=1`;
          const response = await fetch(url, {method: 'Get'})
              .then((res) => res?.json())
              .catch((ex) => {
                logger.error(ex);
                return null;
              });

          if (response?.data?.[0]?.url) {
            imageToSend = response?.data?.[0]?.url;
          } else {
            logger.error('Giphy Invalid Response.');
            logger.error(response);
          }
        }
      }
    }
    return imageToSend;
  }

  /**
     * Calculates and sends the overall average summaries for all players in the game.
     * @param {*} interaction discord interaction if specified the command will reply too.
     * @param {*} discordConnectionsChannel discord channel to send the command output too, only used if not an interaction.
     */
  async execute(interaction, discordConnectionsChannel) {
    let guildId;
    let channelId;
    if (interaction) {
      guildId = interaction.guildId;
      channelId = interaction.channelId;
    } else if (discordConnectionsChannel) {
      guildId = discordConnectionsChannel.guildId;
      channelId = discordConnectionsChannel.id;
    } else {
      logger.error('invalid Summary command call. no interaction or channel');
      throw new Error('Invalid Summary call');
    }

    const [latestGameNumber] = await Promise.all([
      this.connectionGame.getLatestGame(),
    ]);

    const [latestGame, overallSummary, day7Summary, latestScores] = await Promise.all([
      this.connectionGame.getConnectionGame(latestGameNumber),
      this.connectionScore.getPlayerSummaries(guildId, channelId),
      this.connectionScore.getLast7DaysSummaries(guildId, channelId),
      this.connectionScore.getPlayerInfoForGame(latestGameNumber, guildId, channelId),
    ]);
    let imageToSend = this.getImage(latestGame);
    const sum7dayByUser = day7Summary.reduce((acc, sum) => {
      acc[sum.username] = sum;
      return acc;
    }, {});
    const summaryTable = new AsciiTable('Connections Summary');
    summaryTable.setHeading('User', 'GP', 'AS', '7DA');
    overallSummary.forEach((row) => {
      const totalGames = +row.games;
      const day7Summary = {
        gamesPlayed: '',
        average: '',
        gamesLost: '',
      };
      if (sum7dayByUser[row.username]) {
        day7Summary.gamesPlayed = sum7dayByUser[row.username].games;
        day7Summary.average = sum7dayByUser[row.username].average;
        day7Summary.gamesLost = sum7dayByUser[row.username].gameslost;
      }
      summaryTable.addRow(
          USER_TO_NAME_MAP[row.username] || row.username,
          totalGames,
          row.average,
          day7Summary.average);
    });

    const overallLeaderIndex = overallSummary?.[0]?.username === 'Connections Bot' ? 1 : 0;
    const day7LeaderIndex = day7Summary?.[0]?.username === 'Connections Bot' ? 1 : 0;

    let highestScore = 0;
    const todayByScore = latestScores.reduce((acc, scoreVal) => {
      if (scoreVal.username === 'Connections Bot') {
        return acc;
      }
      if (highestScore < +scoreVal.score) {
        highestScore = +scoreVal.score;
      }
      if (!acc[+scoreVal.score]?.length) {
        acc[+scoreVal.score] = [USER_TO_NAME_MAP[scoreVal.username] || scoreVal.username];
      } else {
        acc[+scoreVal.score].push(USER_TO_NAME_MAP[scoreVal.username] || scoreVal.username);
      }
      return acc;
    }, {});

    const messageToSend = `\`\`\`
${summaryTable.toString()}\`\`\`
***Overall Leader: ${USER_TO_NAME_MAP[overallSummary?.[overallLeaderIndex]?.username] || overallSummary?.[overallLeaderIndex]?.username}***
**7 Day Leader: ${USER_TO_NAME_MAP[day7Summary?.[day7LeaderIndex]?.username] || day7Summary?.[day7LeaderIndex]?.username}**
**Today's Winners: ${todayByScore[highestScore]?.join(', ')}**
    ${FOOTER_MESSAGE ? `*${FOOTER_MESSAGE}*`: ''}`;
    imageToSend = await imageToSend;
    if (interaction) {
      await interaction.deferReply({ephemeral: true});
      await interaction.followUp({content: 'Processing...', ephemeral: true});
      if (imageToSend) {
        await interaction.followUp({
          content: messageToSend,
          files: [{
            attachment: imageToSend,
            name: 'SPOILER_FILE.gif',
          }],
        });
      } else {
        await interaction.followUp(messageToSend);
      }
    } else {
      if (imageToSend) {
        await discordConnectionsChannel.send({
          content: messageToSend,
          files: [{
            attachment: imageToSend,
            name: 'SPOILER_FILE.gif',
          }],
        });
      } else {
        await discordConnectionsChannel.send(messageToSend);
      }
    }
    this.connectionGame.summaryPosted(latestGameNumber);
  }
}

module.exports = ConnectionSummaryCommand;
