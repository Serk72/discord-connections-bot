const {ConnectionsBotClient} = require('../src/ConnectionsBotClient');
const {ConnectionScore} = require('../src/data/ConnectionScore');
const {ConnectionsSummaryCommand, ConnectionsWhoLeftCommand} = require('../src/commands');
const fetch = require('node-fetch-native');

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.mock('node-fetch-native', () => {
  return jest.fn().mockResolvedValue({json: () => ({})});
});
jest.mock('../src/data/ConnectionScore', () => {
  return ({
    ConnectionScore: {
      getInstance: jest.fn().mockReturnValue({
        getScore: jest.fn().mockResolvedValue(),
        createScore: jest.fn().mockResolvedValue(),
        getTotalPlayers: jest.fn().mockResolvedValue([]),
        getPlayersForGame: jest.fn().mockResolvedValue([]),
      }),
    },
  });
});
jest.mock('../src/data/ConnectionGame', () => {
  return ({
    ConnectionGame: {
      getInstance: jest.fn().mockReturnValue({
        getConnectionGame: jest.fn().mockResolvedValue(),
        createConnectionGame: jest.fn().mockResolvedValue(),
        getLatestGame: jest.fn().mockResolvedValue(342),
        addGameInfo: jest.fn().mockResolvedValue(),
      }),
    },
  });
});

jest.mock('../src/commands/ConnectionsSummaryCommand', () => {
  return ({
    getInstance: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue(),
      data: {name: 'connectionsummary'},
    }),
  });
});
jest.mock('../src/commands/ConnectionsWhoLeftCommand', () => {
  return ({
    getInstance: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue(),
      data: {name: 'connectionwholeft'},
    }),
  });
});
const mockedDiscordChannel = {send: jest.fn().mockResolvedValue()};
describe('ConnectionsBotClient Tests', () => {
  const connectionsBot = new ConnectionsBotClient(mockedDiscordChannel);
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('Empty Message', async () => {
    await connectionsBot.messageHandler({content: '', channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('Empty Message In connections Channel', async () => {
    await connectionsBot.messageHandler({channelId: '1232', content: '', channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('WhoLeft In connections Channel', async () => {
    await connectionsBot.messageHandler({channelId: '1232', content: '!connectionwholeft', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });
  test('WhoLeft In connections Channel', async () => {
    await connectionsBot.messageHandler({channelId: '1232', content: '/connectionwholeft', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });

  test('Summary In connections Channel', async () => {
    await connectionsBot.messageHandler({channelId: '1232', content: '!connectionsummary', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('Summary In connections Channel', async () => {
    await connectionsBot.messageHandler({channelId: '1232', content: '/connectionsummary', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('connections Score', async () => {
    await connectionsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('connections Score not new', async () => {
    ConnectionScore.getInstance().getScore.mockResolvedValueOnce({});
    await connectionsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('connections Score invalid solution response', async () => {
    fetch.mockResolvedValueOnce(new Error());
    await connectionsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('connections Score Insult username left', async () => {
    ConnectionScore.getInstance().getTotalPlayers.mockResolvedValueOnce(['someUser']);
    await connectionsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(ConnectionsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(ConnectionsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });


  test('Edit Event', async () => {
    await connectionsBot.editEvent({channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
  });

  test('Edit Event connections', async () => {
    reply = jest.fn().mockResolvedValue();
    await connectionsBot.editEvent({author: {username: 'test'}, channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {author: {username: 'test'}, channelId: '1232', channel: {id: '234', guildId: '123'}, content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, lineReply: reply});
    expect(reply).toBeCalledWith('I got you, Edited Connections Score Counted.');
  });

  test('Edit Event connections', async () => {
    ConnectionScore.getInstance().getScore.mockResolvedValueOnce(1);
    reply = jest.fn().mockResolvedValue();
    await connectionsBot.editEvent({author: {username: 'test'}, channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {author: {username: 'test'}, channelId: '1232', channel: {id: '234', guildId: '123'}, content: `Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`, delete: ()=>{}, lineReply: reply});
    expect(reply).toBeCalledWith('I saw that, Edited Connections Score Ignored.');
  });
});
