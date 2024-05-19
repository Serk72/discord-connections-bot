const {Pool} = require('pg');
const config = require('config');
const DATABASE_CONFIG = config.get('postgres');
/**
 * Data Access layer for the ConnectionScore Table.
 */
class ConnectionScore {
  pool;
  static _instance;
  /**
   * Singleton instance.
   * @return {Score} the singleton instance
   */
  static getInstance() {
    if (!ConnectionScore._instance) {
      ConnectionScore._instance = new ConnectionScore();
    }
    return ConnectionScore._instance;
  }
  /**
   * Constructor.
   */
  constructor() {
    this.pool = new Pool({
      user: DATABASE_CONFIG.user,
      host: DATABASE_CONFIG.host,
      database: DATABASE_CONFIG.database,
      password: DATABASE_CONFIG.password,
      port: DATABASE_CONFIG.port,
    });
    const tablesSQL = `CREATE TABLE IF NOT EXISTS 
    ConnectionScore (
      Id serial PRIMARY KEY,
      ConnectionGame INT NOT NULL,
      UserName VARCHAR (255),
      UserTag VARCHAR (255),
      Message VARCHAR (255),
      CompletedCategory1 BOOL,
      CompletedCategory2 BOOL,
      CompletedCategory3 BOOL,
      CompletedCategory4 BOOL,
      Plays INT,
      Score INT,
      GuildId VARCHAR (255),
      ChannelId VARCHAR (255),
      Date TIMESTAMP);`;
    this.pool.query(tablesSQL, [], (err, res) => {
      if (err) {
        console.error(err);
        return;
      }
    });
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  /**
   * Gets the users score for the given wordle game if it exists.
   * @param {*} user The user to find the score for.
   * @param {*} connectionGame The connection game number to look for.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} The Score entry if it exists.
   */
  async getScore(user, connectionGame, guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM 
    ConnectionScore Where
     UserName = $1
     AND ConnectionGame = $2
     AND GuildId = $3
     AND ChannelId = $4`, [user, connectionGame, guildId, channelId]);
    return results?.rows?.[0];
  }

  /**
   * Adds a new Score to the database.
   * @param {*} user User to store the score for.
   * @param {*} userTag User tag for the user.
   * @param {*} connectionMessage Connection String in the format of
Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪
   * @param {*} connectionGame Connection game number to store.
   * @param {*} timestamp Timestamp of when the score was recorded.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   */
  async createScore(user, userTag, connectionMessage, connectionGame, timestamp, guildId, channelId) {
    const splitMessage = connectionMessage.split(/\r?\n/);
    const plays = splitMessage.length - 2;
    const completedCategory1 = connectionMessage.includes('🟨🟨🟨🟨');
    const completedCategory2 = connectionMessage.includes('🟩🟩🟩🟩');
    const completedCategory3 = connectionMessage.includes('🟦🟦🟦🟦');
    const completedCategory4 = connectionMessage.includes('🟪🟪🟪🟪');
    const score = plays - 4;
    await this.pool.query(`
    INSERT INTO 
    ConnectionScore(ConnectionGame, UserName, UserTag, Message, CompletedCategory1, CompletedCategory2, CompletedCategory3, CompletedCategory4, Plays, Score, Date, GuildId, ChannelId)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), $12, $13)`, [connectionGame, user, userTag, connectionMessage, completedCategory1, completedCategory2, completedCategory3, completedCategory4, plays, score, timestamp/1000, guildId, channelId]);
  }

  /**
   * Gets a list of all usernames in the Score table.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames in the Score table.
   */
  async getTotalPlayers(guildId, channelId) {
    const results = await this.pool.query(`SELECT DISTINCT(UserName) FROM ConnectionScore WHERE GuildId = $1 AND ChannelId = $2 AND UserName != 'Connections Bot' AND Date > now() - interval '7 days'`, [guildId, channelId]);
    return results?.rows?.map((row) => row.username);
  }

  /**
   * Gets all the usernames that have played the connections game number.
   * @param {*} connectionsGame connections game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames that have played the game number.
   */
  async getPlayersForGame(connectionsGame, guildId, channelId) {
    const results = await this.pool.query(`SELECT DISTINCT(UserName) FROM ConnectionScore WHERE ConnectionGame = $1 AND GuildId = $2 AND ChannelId = $3 AND UserName != 'Connections Bot' AND Date > now() - interval '7 days'`, [connectionsGame, guildId, channelId]);
    return results?.rows?.map((row) => row.username);
  }

  /**
   * Gets all the userInfo that have played the connections game number.
   * @param {*} connectionsGame connections game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames that have played the game number.
   */
  async getPlayerInfoForGame(connectionsGame, guildId, channelId) {
    const results = await this.pool.query(`SELECT * FROM ConnectionScore WHERE ConnectionGame = $1 AND GuildId = $2 AND ChannelId = $3 AND UserName != 'Connections Bot'`, [connectionsGame, guildId, channelId]);
    return results?.rows;
  }
}

module.exports = {ConnectionScore};
