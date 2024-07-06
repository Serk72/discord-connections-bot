const {SlashCommandBuilder} = require('discord.js');
const {ConnectionGame} = require('../data/ConnectionGame');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'ExplainPlayCommand.js',
  level: config.get('logLevel'),
});
const fetch = require('node-fetch-native');

const OLLAMA_CONFIG = config.get('ollama');

/**
 * Command for explaining an ai play.
 */
class ExplainPlayCommand {
  static _instance;
  /**
   * Singleton instance.
   * @return {ExplainPlayCommand} the singleton instance
   */
  static getInstance() {
    if (!ExplainPlayCommand._instance) {
      ExplainPlayCommand._instance = new ExplainPlayCommand();
    }
    return ExplainPlayCommand._instance;
  }
  static data = new SlashCommandBuilder()
      .setName('explain_play')
      .addIntegerOption((option) =>
        option.setName('connections_game')
            .setDescription('The Connections Game Number to play')
            .setMinValue(0))
      .setDescription('Makes the bot explain its play Connections game or latest.');
  /**
   * Constructor.
   */
  constructor() {
    this.connectionGame = ConnectionGame.getInstance();
    this.data = ExplainPlayCommand.data;
  }

  /**
   * explains a wordle game play and posts the score.
   * @param {*} interaction discord interaction if specified the command will reply too.
   * @param {*} discordWordleChannel discord channel to send the command output too, only used if not an interaction.
   */
  async execute(interaction, discordWordleChannel) {
    let gameNumber;
    if (interaction) {
      gameNumber = interaction.options.getInteger('connections_game');
    }
    if (!gameNumber) {
      gameNumber = await this.connectionGame.getLatestGame();
    }

    if (interaction) {
      await interaction.deferReply({ephemeral: true});
      await interaction.followUp({content: 'Processing...', ephemeral: true});
    }

    let messageToSend = await this.explainGame(gameNumber);

    if (!messageToSend) {
      messageToSend = `Unable to explain Connection Game: ${gameNumber.toLocaleString()}`;
    }
    if (interaction) {
      await interaction.followUp(`||${messageToSend}||`);
    } else {
      await discordWordleChannel.send(messageToSend);
    }
  }

  /**
   * Attempts to explain the play for a particular game.
   * @param {*} gameNumber game number to explain
   * @return {String} message to send
   */
  async explainGame(gameNumber) {
    const messages = (await this.connectionGame.getConnectionGame(gameNumber))?.aimessages?.messages;
    if (!messages) {
      return;
    }

    const modelName = OLLAMA_CONFIG.generateModel ? OLLAMA_CONFIG.generatedModelName : OLLAMA_CONFIG.modelName;

    messages.push({
      role: 'user',
      content: 'Explain your plays.',
    });
    const url = `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/chat`;
    const finalresponse = await fetch(url, {method: 'POST', body: JSON.stringify(
        {
          model: modelName,
          stream: false,
          options: {
            seed: 123,
            temperature: 0,
          },
          messages: messages,
        })})
        .then((res) => res.json())
        .catch((ex) => {
          logger.info(ex);
          playGame = false;
          return null;
        });
    return finalresponse.message.content;
  }
}

module.exports = ExplainPlayCommand;
