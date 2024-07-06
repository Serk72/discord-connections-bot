const {SlashCommandBuilder} = require('discord.js');
const {ConnectionGame} = require('../data/ConnectionGame');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'PlayConnectionsCommand.js',
  level: config.get('logLevel'),
});
const {Agent, fetch} = require('undici');

const OLLAMA_CONFIG = config.get('ollama');

/**
 * Command for playing a connections game.
 */
class PlayConnectionsCommand {
  static _instance;
  /**
   * Singleton instance.
   * @return {PlayConnectionsCommand} the singleton instance
   */
  static getInstance() {
    if (!PlayConnectionsCommand._instance) {
      PlayConnectionsCommand._instance = new PlayConnectionsCommand();
    }
    return PlayConnectionsCommand._instance;
  }
  static data = new SlashCommandBuilder()
      .setName('play_connections')
      .addIntegerOption((option) =>
        option.setName('connections_game')
            .setDescription('The Connections Game Number to play')
            .setMinValue(0))
      .setDescription('Makes the bot play the given Connections game or latest.');
  /**
   * Constructor.
   */
  constructor() {
    this.connectionGame = ConnectionGame.getInstance();
    this.data = PlayConnectionsCommand.data;
  }

  /**
   * Plays a wordle game and posts the score.
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

    let messageToSend = await this.playGame(gameNumber, interaction);

    if (!messageToSend) {
      messageToSend = `Unable to play Connection Game: ${gameNumber.toLocaleString()}`;
    }
    if (interaction) {
      await interaction.followUp(messageToSend);
    } else {
      await discordWordleChannel.send(messageToSend);
    }
  }

  /**
   * Attempts to play for a particular game.
   * @param {*} gameNumber game number to play
   * @param {*} interaction the interaction to respond to.
   * @return {String} message to send
   */
  async playGame(gameNumber, interaction) {
    const indexColor = ['yellow', 'green', 'blue', 'purple'];
    const gameJSON = (await this.connectionGame.getConnectionGame(gameNumber))?.jsongameinfo;
    if (!gameJSON) {
      logger.error('Game info not found.');
      return;
    }
    if (OLLAMA_CONFIG.generateModel) {
      const createURL = `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/create`;
      await fetch(createURL, {method: 'POST', body: JSON.stringify({
        name: OLLAMA_CONFIG.generatedModelName,
        stream: false,
        modelfile: `FROM ${OLLAMA_CONFIG.modelName}
        SYSTEM """You will play a game of new york times connections
        you will be provided a 4 x 4 list of items to connect separated by '--', you will respond only with the first 4 items you think are connected and no other info
        The response given after will tell you if that connection is correct, if it is one away from a correct answer, or if it is not a correct connection
        you will have 4 miss guesses before the game is lost
        after a game is played if you see the promt explain you will describe your choices made in the game
        
        games start with the prompt "Play this connections game"

        Please do not add any other text other than the 4 guesses, which are from the 4x4 game board, in each play response. Separate guesses with '--'

         explore more connections between the words, rather than just focusing on individual word associations.
         take into account categories or themes the words actually belong to
        """`})})
          .then((res) => res.text())
          .catch((ex) => {
            logger.error(ex);
            return null;
          });
    }

    const modelName = OLLAMA_CONFIG.generateModel ? OLLAMA_CONFIG.generatedModelName : OLLAMA_CONFIG.modelName;

    let messages = (await this.connectionGame.getConnectionGame(gameNumber - 1))?.aimessages?.messages;
    if (!messages) {
      messages = [];
    }
    messages.push(
        {
          role: 'user',
          content: `Play this connections game, Respond with one play at a time:
${this.generateGame(gameJSON)}`,
        });


    const gameByCategory = this.getGameByCategory(gameJSON);
    let playGame = true;
    let misses = 0;
    let correct = 0;
    let rounds = 0;
    let gameMessage = 'Connections\nPuzzle #' + gameNumber.toLocaleString() + '\n';
    const pastPlays = [];
    while (playGame) {
      logger.info(messages[messages.length -1]);
      rounds++;
      if (rounds >= 20) {
        break;
      }
      const url = `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/chat`;
      Agent;
      const response = await fetch(url, {method: 'POST',
        dispatcher: new Agent({connectTimeout: 86400000, bodyTimeout: 86400000, headersTimeout: 86400000, keepAliveMaxTimeout: 86400000, keepAliveTimeout: 86400000}),
        body: JSON.stringify({
          model: modelName,
          stream: false,
          options: {
            seed: 123,
            temperature: 0,
          },
          messages: messages,
        })})
          .then((res) => res.json())
          .then((res) => {
            logger.info(`Response took ${res?.total_duration/60000000000} min`);
            return res;
          })
          .catch((ex) => {
            logger.error(ex);
            playGame = false;
            return null;
          });
      if (!response?.message) {
        logger.error('Invalid response');
        return;
      }
      messages.push(response.message);
      logger.info(messages[messages.length -1]);

      const currentPlay = response.message.content.split('--').map((guess) => guess.trim()).filter((guess) => !!guess).map((guess) => guess.toUpperCase());
      logger.info(currentPlay);

      if (currentPlay.length < 4) {
        messages.push({
          role: 'user',
          content: `Invalid Play Detected, not enough items, Please only respond with one guess separated by '--' with 4 entries from the game and no other info.`,
        });
        if (interaction) {
          await interaction.followUp({content: `Played ${rounds}. Invalid Play`, ephemeral: true});
        }
        continue;
      }
      if (currentPlay.length > 4) {
        messages.push({
          role: 'user',
          content: `Invalid Play Detected, too many items, Please only respond with one guess separated by '--' with 4 entries from the game and no other info.`,
        });
        if (interaction) {
          await interaction.followUp({content: `Played ${rounds}. Invalid Play`, ephemeral: true});
        }
        continue;
      }
      const invalid = [];
      currentPlay.forEach((word) => {
        if (!Object.keys(gameByCategory.wordToIconMap).includes(word)) {
          invalid.push(word);
        }
      });
      if (invalid.length) {
        messages.push({
          role: 'user',
          content: `Invalid Play Detected, invalid words detected (${invalid.join(', ')}) are not valid guesses, Valid guesses include (${Object.keys(gameByCategory.wordToIconMap).join(', ')}), Please only respond with one play separated by '--' with 4 entries from the game and no other info.`,
        });
        if (interaction) {
          await interaction.followUp({content: `Played ${rounds}. Invalid Play`, ephemeral: true});
        }
        continue;
      }

      let alreadyPlayed = false;
      pastPlays.forEach((pastPlay) => {
        let matched = 0;
        pastPlay.forEach((guess) => {
          if (currentPlay.includes(guess)) {
            matched++;
          }
        });
        if (matched >= 4) {
          alreadyPlayed = true;
        }
      });

      if (alreadyPlayed) {
        messages.push({
          role: 'user',
          content: `You already made this play, Please make a different guess.`,
        });
        if (interaction) {
          await interaction.followUp({content: `Played ${rounds}. Invalid Play`, ephemeral: true});
        }
        continue;
      }
      pastPlays.push(currentPlay);
      const play = this.evalPlay(currentPlay, gameByCategory);

      if (interaction) {
        await interaction.followUp({content: `Played ${rounds}. ${JSON.stringify(play)}`, ephemeral: true});
      }

      currentPlay.forEach((word) => {
        gameMessage += gameByCategory.wordToIconMap[word];
      });
      gameMessage += '\n';
      if (play.correct) {
        currentPlay.forEach((guess) => {
          // Remove from valid plays.
          delete gameByCategory.wordToIconMap[guess];
        });
        correct++;
        if (correct >= 4) {
          break;
        }
        messages.push({
          role: 'user',
          content: `Correct, you guessed the ${indexColor[play.categoryIndex]} category, which was ${play.categoryName}. Please Enter Next Guess`,
        });
      } else if (play.offByOne) {
        misses++;
        if (misses >= 4) {
          break;
        }
        messages.push({
          role: 'user',
          content: `Incorrect, but you are off by one. Please Enter Next Guess. Try to find the guess to replace, in your last response, to get the correct answer.`,
        });
      } else {
        misses++;
        if (misses >= 4) {
          break;
        }

        messages.push({
          role: 'user',
          content: `Incorrect. Please Enter Next Guess`,
        });
      }
    }
    if (correct >= 4) {
      messages.push({
        role: 'user',
        content: 'Correct, You win All Categories have been guessed.',
      });
    } else if (misses >= 4) {
      messages.push({
        role: 'user',
        content: `Incorrect, Game Over
The Correct Connections with their category name are:
${gameByCategory.categoryNames[0]}
${gameByCategory.categoryContent[0].join('--')}
${gameByCategory.categoryNames[1]}
${gameByCategory.categoryContent[1].join('--')}
${gameByCategory.categoryNames[2]}
${gameByCategory.categoryContent[2].join('--')}
${gameByCategory.categoryNames[3]}
${gameByCategory.categoryContent[3].join('--')}`,
      });
    } else {
      // Invalid game.
      return '';
    }
    logger.info(messages[messages.length -1]);
    const url = `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/chat`;
    const response = await fetch(url,
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
                model: modelName,
                stream: false,
                options: {
                  seed: 123,
                  temperature: 0,
                },
                messages: messages,
                keep_alive: '10m',
              })})
        .then((res) => res.json())
        .then((res) => {
          logger.info(`Response took ${res?.total_duration/60000000000} min`);
          return res;
        })
        .catch((ex) => {
          logger.error(ex);
          playGame = false;
          return null;
        });
    if (!response?.message) {
      return null;
    }
    messages.push(response.message);
    logger.info(messages[messages.length -1]);
    await this.connectionGame.storeAIPlay(gameNumber, messages);
    logger.info(gameMessage);
    return gameMessage;
  }

  /**
   * Generates a game board given a game info object.
   * @param {*} gameInfo full connections game info from nyt
   * @return {String} String game board that can be provided to the model to play a game.
   */
  generateGame(gameInfo) {
    let gameboard = '';
    const content = gameInfo.categories.reduce((acc, cur) => {
      cur.cards.forEach((card) => {
        acc[card.position] = card.content;
      });
      return acc;
    }, [...Array(16)].fill(0));

    content.forEach((word, index) => {
      gameboard += `${index%4 === 0 ? index === 0 ? '' : '\n': '--'}${word}`;
    });
    return gameboard;
  }

  /**
   * Generates arrays containing category info and word mappings.
   * @param {*} gameInfo full connections game info from nyt
   * @return {*} object containing category names, content, and word to icon color map.
   */
  getGameByCategory(gameInfo) {
    const indexIcon = ['🟨', '🟩', '🟦', '🟪'];
    return gameInfo.categories.reduce((acc, cur, index) => {
      acc.categoryNames[index] = cur.title;
      acc.categoryContent[index] = cur.cards.map((card) => card.content);
      cur.cards.forEach((card) => {
        acc.wordToIconMap[card.content] = indexIcon[index];
      });
      return acc;
    }, {
      categoryNames: [...Array(4)].fill(0),
      categoryContent: [...Array(4)].fill(0),
      wordToIconMap: {},
    });
  }

  /**
   * Evaluates a play
   * @param {*} guess Array of guesses.
   * @param {*} gameByCategory  game info object.
   * @return {*} evaluation of play.
   */
  evalPlay(guess, gameByCategory) {
    let correctGuess = false;
    let offByOne = false;
    let correctIndex = -1;
    for (let i = 0; i < 4; i++) {
      let matches = 0;
      for (let j = 0; j < 4; j++) {
        if (gameByCategory.categoryContent[i].includes(guess[j])) {
          matches++;
        }
      }
      if (matches === 3) {
        offByOne = true;
        break;
      }
      if (matches === 4) {
        correctGuess = true;
        correctIndex = i;
        break;
      }
    }

    if (correctGuess) {
      return {
        correct: true,
        offByOne: false,
        categoryIndex: correctIndex,
        categoryName: gameByCategory.categoryNames[correctIndex],
      };
    } else if (offByOne) {
      return {
        correct: false,
        offByOne: true,
      };
    } else {
      return {
        correct: false,
        offByOne: false,
      };
    }
  }
}

module.exports = PlayConnectionsCommand;
