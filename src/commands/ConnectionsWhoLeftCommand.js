const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {ConnectionGame} = require('../data/ConnectionGame');
const {ConnectionScore} = require('../data/ConnectionScore');
const {AIMessages} = require('../data/AIMessages');
const {Agent, fetch} = require('undici');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'ConnectionsWhoLeftCommand.js',
  level: config.get('logLevel'),
});
const INSULT_USERNAME = config.get('insultUserName');
const INSULT_USER_ID = config.get('insultUserId');
const FOOTER_MESSAGE = config.get('footerMessage');
const OLLAMA_CONFIG = config.get('ollama');

/**
 * Command for determining what players have not completed the days wordle and senda a message
 * indicated players that have not finished yet to the WORDLE_CHANNEL_ID channel.
 */
class ConnectionsWhoLeftCommand {
  static _instance;
  /**
   * Singleton instance.
   * @return {ConnectionsWhoLeftCommand} the singleton instance
   */
  static getInstance() {
    if (!ConnectionsWhoLeftCommand._instance) {
      ConnectionsWhoLeftCommand._instance = new ConnectionsWhoLeftCommand();
    }
    return ConnectionsWhoLeftCommand._instance;
  }
  static data = new SlashCommandBuilder()
      .setName('connectionswholeft')
      .setDescription('Posts who has not completed the current Connections for the day.');
  /**
   * Constructor.
   */
  constructor() {
    this.connectionGame = ConnectionGame.getInstance();
    this.connectionScore = ConnectionScore.getInstance();
    this.aiMessages = AIMessages.getInstance();
    this.data = ConnectionsWhoLeftCommand.data;
  }

  /**
   * Determines what players have not completed the days wordle and senda a message
   * indicated players that have not finished yet to the WORDLE_CHANNEL_ID channel.
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
      logger.error('invalid WhoLeft command call. no interaction or channel');
      throw new Error('Invalid WhoLeft call');
    }
    const latestGame = await this.connectionGame.getLatestGame();
    const totalPlayes = await this.connectionScore.getTotalPlayers(guildId, channelId);
    const gamePlayers = await this.connectionScore.getPlayersForGame(latestGame, guildId, channelId);
    let embed;
    if (totalPlayes.length === gamePlayers.length) {
      embed = new EmbedBuilder()
          .setTitle(`Everyone is done with ${latestGame}`)
          .setColor('#4169e1'); // set the color of the em
      embed.setDescription(`All done.`);
    } else {
      if (totalPlayes.length - gamePlayers.length === 1) {
        const remaining = totalPlayes.filter((player) => !gamePlayers.includes(player));
        if (remaining[0] === INSULT_USERNAME) {
          embed = new EmbedBuilder()
              .setTitle(`Once again ${INSULT_USERNAME} is the last one remaining...`)
              .setColor('#4169e1');
        } else {
          embed = new EmbedBuilder()
              .setTitle('One player Remaining')
              .setColor('#4169e1');
        }
      } else {
        embed = new EmbedBuilder()
            .setTitle('People not done')
            .setColor('#4169e1'); // set the color of the em
      }
      const insultMessage = await this.getAIMessage(latestGame);
      totalPlayes.filter((player) => !gamePlayers.includes(player)).forEach((player) => {
        if (player === INSULT_USERNAME) {
          embed.addFields({name: `${player}`, value: insultMessage});
        } else {
          embed.addFields({name: `${player}`, value: `Has not completed Connections ${latestGame}`});
        }
      });
      if (FOOTER_MESSAGE) {
        embed.setFooter({text: FOOTER_MESSAGE} );
      }
    }
    if (interaction) {
      interaction.reply({embeds: [embed]});
    } else {
      await discordConnectionsChannel.send({embeds: [embed]});
    }
  }

  /**
   * Attempts to get an AI generated message for the insult player.
   * @param {*} latestGame game number generated for.
   * @return {string} An AI generated message or random hardcoded message if getting the AI message from ollama fails.
   */
  async getAIMessage(latestGame) {
    let response;
    let messages;
    if (OLLAMA_CONFIG.generateMessages) {
      messages = (await this.aiMessages.getMessageList('connectionsInsults')) || [];
      messages.push({
        role: 'user',
        content: `Generate an insult for Connections Game ${latestGame}`,
      });
      const url = `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/chat`;
      response = await fetch(url,
          {
            method: 'POST',
            dispatcher: new Agent(
                {
                  connectTimeout: 86400000,
                  bodyTimeout: 86400000,
                  headersTimeout: 86400000,
                  keepAliveMaxTimeout: 86400000,
                  keepAliveTimeout: 86400000,
                }),
            body: JSON.stringify(
                {
                  model: OLLAMA_CONFIG.insultModelName,
                  stream: false,
                  messages: messages,
                })})
          .then((res) => res.json())
          .then((res) => {
            logger.info(`Response took ${res?.total_duration/60000000000} min`);
            return res;
          })
          .catch((ex) => {
            logger.error(ex);
            return null;
          });
      messages.push(response.message);
    }

    if (response?.message?.content) {
      await this.aiMessages.updateMessageList('connectionsInsults', messages);
      return response.message?.content.replaceAll('[Name]', `${INSULT_USER_ID}`).replaceAll('[Player]', `${INSULT_USER_ID}`);
    } else {
      logger.error('Unable to generate insult.');
      const insultMessages = [
        `Is too lazy to complete Connections ${latestGame}`,
        `Is holding everone else back on Connections ${latestGame}, he's the worst`,
        `Is the worst. Complete Connections ${latestGame} already!`,
        `Has time to edit discord names but not complete Connections ${latestGame}`,
        `As per usual has not completed Connections ${latestGame}`,
      ];
      const randomIndex = Math.floor(Math.random() * 5);

      return insultMessages[randomIndex];
    }
  }
}

module.exports = ConnectionsWhoLeftCommand;
