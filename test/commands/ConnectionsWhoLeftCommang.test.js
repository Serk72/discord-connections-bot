const ConnectionsWhoLeftCommand = require('../../src/commands/ConnectionsWhoLeftCommand');
const {ConnectionScore} = require('../../src/data/ConnectionScore');
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.mock('../../src/data/ConnectionScore', () => {
  return ({
    ConnectionScore: {
      getInstance: jest.fn().mockReturnValue({
        getTotalPlayers: jest.fn().mockResolvedValue([]),
        getPlayersForGame: jest.fn().mockResolvedValue([]),
      }),
    },
  });
});
jest.mock('../../src/data/AIMessages', () => {
  return ({
    AIMessages: {
      getInstance: jest.fn().mockReturnValue({
        getTotalPlayers: jest.fn().mockResolvedValue([]),
        getPlayersForGame: jest.fn().mockResolvedValue([]),
      }),
    },
  });
});
jest.mock('../../src/data/ConnectionGame', () => {
  return ({
    ConnectionGame: {
      getInstance: jest.fn().mockReturnValue({
        getLatestGame: jest.fn().mockResolvedValue(1),
      }),
    },
  });
});
const mockedDiscordChannel = {send: jest.fn().mockResolvedValue()};
describe('ConnectionsWhoLeftCommand Tests', () => {
  const whoLeftCommand = ConnectionsWhoLeftCommand.getInstance();
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('Everyone done, empty respons Channel', async () => {
    await whoLeftCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalled();
  });

  test('Everyone done, empty respons Interaction', async () => {
    const mockedInteraction = {reply: jest.fn().mockResolvedValue()};
    await whoLeftCommand.execute(mockedInteraction);
    expect(mockedInteraction.reply).toBeCalled();
  });

  test('1 left Channel', async () => {
    ConnectionScore.getInstance().getTotalPlayers.mockResolvedValueOnce(['test']);
    await whoLeftCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalled();
  });

  test('multiple left Channel', async () => {
    ConnectionScore.getInstance().getTotalPlayers.mockResolvedValueOnce(['test', 'test2']);
    await whoLeftCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalled();
  });

  test('insult user left Channel', async () => {
    ConnectionScore.getInstance().getTotalPlayers.mockResolvedValueOnce(['someUser']);
    await whoLeftCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalled();
  });

  test('test invalid command', async () => {
    let error = false;
    try {
      await whoLeftCommand.execute(null, null);
    } catch (err) {
      error = true;
    }
    expect(error).toBe(true);
  });
});
