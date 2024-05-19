const {Client, GatewayIntentBits, Events, Routes, REST} = require('discord.js');
const {ConnectionsBotClient} = require('./src/ConnectionsBotClient');
const {ConnectionsSummaryCommand} = require('./src/commands');
const {ConnectionGame} = require('./src/data/ConnectionGame');

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent]});
const config = require('config');
const commands = require('./src/commands');
const CONNECTIONS_CHANNEL_ID = config.get('autoPostSummaryChannel');
const AUTO_POST_HOUR = config.get('autoPostHour');
const AUTO_POST_MIN = config.get('autoPostMin');
const runAtSpecificTimeOfDay = (hour, minutes, func) => {
  const twentyFourHours = 86400000;
  const now = new Date();
  let etaMS = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, 0, 0).getTime() - now;
  if (etaMS < 0) {
    etaMS += twentyFourHours;
  }
  setTimeout(() => {
    // run once
    func();
    // run every 24 hours from now on
    setInterval(func, twentyFourHours);
  }, etaMS);
};

const rest = new REST({version: '10'}).setToken(config.get('discordBotToken'));
client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach((guild) => {
    rest.put(Routes.applicationGuildCommands(config.get('applicationId'), guild.id), {
      body: Object.keys(commands).map((command) => commands[command].data.toJSON()),
    });
  });
  console.log(`Connected to ${client.guilds.cache.size} guilds`);
  const botClient = new ConnectionsBotClient();

  client.on(Events.MessageUpdate, botClient.editEvent.bind(botClient));
  client.on(Events.MessageCreate, botClient.messageHandler.bind(botClient));
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const exeCommand = Object.keys(commands).map((command) => commands[command].getInstance()).find((command) => command.data.name === interaction.commandName);
    if (!exeCommand) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    try {
      await exeCommand.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({content: `There was an error while executing this command: ${error.message}`, ephemeral: true});
      } else {
        await interaction.reply({content: `There was an error while executing this command: ${error.message}`, ephemeral: true});
      }
    }
  });
});

client.login(config.get('discordBotToken'));

if (CONNECTIONS_CHANNEL_ID) {
  runAtSpecificTimeOfDay(AUTO_POST_HOUR, AUTO_POST_MIN, async () => {
    console.log(`Checking if Summary is to be posted.`);
    const connectionsChannel = client.channels.cache.get(CONNECTIONS_CHANNEL_ID);
    if (!(await ConnectionGame.getInstance().getLatestGameSummaryPosted())) {
      await ConnectionsSummaryCommand.getInstance().execute(null, connectionsChannel);
      await ConnectionGame.getInstance().summaryPosted(await ConnectionGame.getInstance().getLatestGame());
    }
  });
}

