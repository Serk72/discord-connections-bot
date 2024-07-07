const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'ConnectionBotClient.js',
  level: config.get('logLevel'),
});
const dayjs = require('dayjs');
const fetch = require('node-fetch-native');
const {ConnectionGame} = require('./data/ConnectionGame');
const {ConnectionScore} = require('./data/ConnectionScore');
const {ConnectionsSummaryCommand, ConnectionsWhoLeftCommand, PlayConnectionsCommand} = require('./commands');


const INSULT_USERNAME = config.get('insultUserName');
const CONNECTIONS_REGEX = /Connections.*\nPuzzle.*#[0-9,]+.*\n[🟨🟩🟦🟪\n]+/g;
/**
 * Main Bot Class to handle events
 */
class ConnectionsBotClient {
  /**
   * Constructor
   */
  constructor() {
    this.connectionGame = ConnectionGame.getInstance();
    this.connectionScore = ConnectionScore.getInstance();
    this.summaryCommand = ConnectionsSummaryCommand.getInstance();
    this.whoLeftCommand = ConnectionsWhoLeftCommand.getInstance();
    this.playConnectionsGame = PlayConnectionsCommand.getInstance();
  }

  /**
   * Adds a new Score to the database. Scores already added will be ignored.
   * @param {*} message discord message containing a connections score.
   */
  async _addConnectionsScore(message) {
    const found = message?.content?.match(CONNECTIONS_REGEX);
    const connections = found[0];
    const subConnections = connections.substring(connections.indexOf('#')+1);
    const connectionsNumber = Number(subConnections.split(/\r?\n/)[0].replaceAll(',', ''));
    const guildId = message.channel.guildId;
    const channelId = message.channel.id;

    if (!(await this.connectionGame.getConnectionGame(connectionsNumber))) {
      await this.connectionGame.createConnectionGame(connectionsNumber, message.createdTimestamp);
    }
    let newPlay = true;
    if (!(await this.connectionScore.getScore(message.author.username, connectionsNumber, guildId, channelId))) {
      await this.connectionScore.createScore(message.author.username, message.author.tag, connections, connectionsNumber, message.createdTimestamp, guildId, channelId);
    } else {
      newPlay = false;
    }

    const playScore = (await this.connectionScore.getScore(message.author.username, connectionsNumber, guildId, channelId))?.score;

    const reactions = this._convertScoreToEmojiList(playScore);

    try {
      await Promise.all(reactions.map((emoji) => message.react(emoji)));
    } catch (ex) {
      logger.error('unable to react to messaage');
      logger.error(ex);
    }

    const latestGame = await this.connectionGame.getLatestGame();
    // Only post additional messages if game played was for the latest game and not bot post.
    if (connectionsNumber === Number(latestGame) && newPlay && message.author.username !== 'Connections Bot') {
      const totalPlayes = await this.connectionScore.getTotalPlayers(guildId, channelId);
      const gamePlayers = await this.connectionScore.getPlayersForGame(latestGame, guildId, channelId);
      const remaining = totalPlayes.filter((player) => !gamePlayers.includes(player));
      logger.info(`Remaining players: ${remaining}`);
      if (!remaining.length) {
        await this.summaryCommand.execute(null, message.channel);
      } else if (remaining.length === 1) {
        if (remaining[0] === INSULT_USERNAME) {
          await this.whoLeftCommand.execute(null, message.channel);
        }
      }
    }

    const currentGame = await this.connectionGame.getConnectionGame(latestGame);
    if (!currentGame?.jsongameinfo) {
      const day = dayjs().format('YYYY-MM-DD');
      const url = `https://www.nytimes.com/svc/connections/v2/${day}.json`;
      const solution = await fetch(url, {method: 'Get'})
          .then((res) => res?.json())
          .catch((ex) => {
            logger.error(ex);
            return null;
          });
      if (solution?.categories && solution?.categories?.length === 4) {
        await this.connectionGame.addGameInfo(connectionsNumber, solution);
        await this.playConnectionsGame.execute(null, message.channel);
      } else {
        logger.error('Unable to get solution');
        logger.error(solution);
      }
    }
  }

  /**
   * Converts a score to emojis.
   * @param {*} score the score of the play
   * @return {*} the emojis to react with.
   */
  _convertScoreToEmojiList(score) {
    const emojiArray = [];
    switch (score) {
      case 0:
        emojiArray.push('0️⃣');
        emojiArray.push(':ganon:');
        break;
      case 1:
        emojiArray.push('1️⃣');
        break;
      case 2:
        emojiArray.push('2️⃣');
        break;
      case 3:
        emojiArray.push('3️⃣');
        break;
      case 4:
        emojiArray.push('4️⃣');
        break;
      case 5:
        emojiArray.push('5️⃣');
        break;
      case 6:
        emojiArray.push('6️⃣');
        emojiArray.push(':andy_ooh:');
        break;
      default:
        emojiArray.push(':interrobang:');
        break;
    }
    return emojiArray;
  }
  /**
   * Discord Edit Event Handler
   * @param {*} oldMessage The discord message before the edit.
   * @param {*} newMessage The discord message after the edit.
   */
  async editEvent(oldMessage, newMessage) {
    logger.info('edit Event.');
    logger.info(oldMessage?.content);
    logger.info(newMessage?.content);
    const guildId = newMessage.channel.guildId;
    const channelId = newMessage.channel.id;
    const found = newMessage?.content?.match(CONNECTIONS_REGEX);
    if (found && found.length) {
      const connections = found[0];
      const subConnections = connections.substring(connections.indexOf('#')+1);
      const connectionsNumber = Number(subConnections.split(/\r?\n/)[0].replaceAll(',', ''));
      if ((await this.connectionScore.getScore(newMessage.author.username, connectionsNumber, guildId, channelId))) {
        await newMessage.lineReply('I saw that, Edited Connections Score Ignored.');
      } else {
        await this._addConnectionsScore(newMessage);
        await newMessage.lineReply('I got you, Edited Connections Score Counted.');
      }
    }
  }
  /**
   * Discord Message Handler
   * @param {*} message new message to process.
   * @return {*}
   */
  async messageHandler(message) {
    logger.info(message);
    if (message.content.startsWith(`!${this.whoLeftCommand.data.name}`) || message.content.startsWith(`/${this.whoLeftCommand.data.name}`)) {
      message.delete();
      await this.whoLeftCommand.execute(null, message.channel);
      return;
    }
    if (message.content.startsWith(`!${this.summaryCommand.data.name}`) || message.content.startsWith(`/${this.summaryCommand.data.name}`)) {
      message.delete();
      await this.summaryCommand.execute(null, message.channel);
      return;
    }
    if (message.content.startsWith(`!${this.playConnectionsGame.data.name}`) || message.content.startsWith(`/${this.playConnectionsGame.data.name}`)) {
      message.delete();
      await this.playConnectionsGame.execute(null, message.channel);
      return;
    }
    const found = message?.content?.match(CONNECTIONS_REGEX);
    if (found && found.length) {
      await this._addConnectionsScore(message);
    }
  }
}

module.exports = {ConnectionsBotClient};
