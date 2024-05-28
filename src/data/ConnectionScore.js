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
   * Gets all existing scores.
   */
  async getAllScores() {
    const results = await this.pool.query(`
    SELECT * FROM 
    ConnectionScore`);
    return results?.rows;
  }

  /**
   * updates a connection score.
   * @param {*} id connection score database id.
   * @param {*} connectionMessage Connection message to update metadata for.
   */
  async updateScore(id, connectionMessage) {
    const connectionScore = this._processScore(connectionMessage);
    await this.pool.query(`
    UPDATE
    ConnectionScore SET Message = $1, CompletedCategory1 = $2, CompletedCategory2 = $3, CompletedCategory3 = $4, CompletedCategory4 = $5, Plays = $6, Score = $7 WHERE id = $8`,
    [connectionMessage, connectionScore.completedCategory1, connectionScore.completedCategory2, connectionScore.completedCategory3, connectionScore.completedCategory4, connectionScore.plays, connectionScore.score, id]);
  }

  /**
   * Reprocesses all scores to allow for reprocess on changes.
   */
  async reprocessScores() {
    const scores = await this.getAllScores();
    console.log(`processing ${scores.length} scores.`);
    await Promise.all(scores.map((score) => {
      return this.updateScore(score.id, score.message.replaceAll('\\n', '\n'));
    }));
    console.log(`finished processing.`);
  }

  /**
   * Gets all the usernames and scores for a game.
   * @param {*} connectionsGame connections game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames and scores in order.
   */
  async getGameScores(connectionsGame, guildId, channelId) {
    const results = await this.pool.query('SELECT UserName, Score FROM ConnectionScore WHERE connectionGame = $1 AND GuildId = $2 AND ChannelId = $3 ORDER By Score DESC, Date', [connectionsGame, guildId, channelId]);
    return results?.rows;
  }

  /**
   * Processes a score object out of a connection message.
   * @param {*} connectionMessage Connection String in the format of
Connections
Puzzle #342
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪
   * @return {*} object containing the connections completed, plays, and calculated score.
   */
  _processScore(connectionMessage) {
    const splitMessage = connectionMessage.split(/\r?\n/);
    const plays = splitMessage.length - 2;
    let completedCategory1 = false;
    let completedCategory2 = false;
    let completedCategory3 = false;
    let completedCategory4 = false;
    let score = 0;
    if (connectionMessage.includes('🟨🟨🟨🟨')) {
      completedCategory1 = true;
      score++;
    }
    if (connectionMessage.includes('🟩🟩🟩🟩')) {
      completedCategory2 = true;
      score++;
    }
    if (connectionMessage.includes('🟦🟦🟦🟦')) {
      completedCategory3 = true;
      score++;
    }
    if (connectionMessage.includes('🟪🟪🟪🟪')) {
      completedCategory4 = true;
      score++;
    }

    if (score === 4) {
      switch (plays) {
        case 4:
          score += 2;
          break;
        case 5:
          score += 1;
          break;
        case 6:
          score = 3;
        default:
          break;
      }
    }

    return {plays, score, completedCategory1, completedCategory2, completedCategory3, completedCategory4};
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
    const connectionScore = this._processScore(connectionMessage);
    await this.pool.query(`
    INSERT INTO 
    ConnectionScore(ConnectionGame, UserName, UserTag, Message, CompletedCategory1, CompletedCategory2, CompletedCategory3, CompletedCategory4, Plays, Score, Date, GuildId, ChannelId)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), $12, $13)`, [connectionGame, user, userTag, connectionMessage, connectionScore.completedCategory1, connectionScore.completedCategory2, connectionScore.completedCategory3, connectionScore.completedCategory4, connectionScore.plays, connectionScore.score, timestamp/1000, guildId, channelId]);
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

  /**
   * Gets overall summary data for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} overall summary data for all users.
   */
  async getPlayerSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM (SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average,  
      username, 
      (COUNT(CASE WHEN score <= 0 THEN 1 END)) as gameslost 
    FROM ConnectionScore 
    WHERE
      GuildId = $1 AND ChannelId = $2
    GROUP BY  Username 
    ORDER BY Average DESC) as summary`, [guildId, channelId]);
    return results?.rows;
  }

  /**
   * Gets last 7 day summary for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} last 7 day summary for all users.
   */
  async getLast7DaysSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average, 
      username, 
      (COUNT(CASE WHEN score <= 0 THEN 1 END)) as gameslost 
    FROM ConnectionScore 
    WHERE 
      Date > now() - interval '7 days' AND GuildId = $1 AND ChannelId = $2
    GROUP BY Username
    ORDER BY Average DESC`, [guildId, channelId]);
    return results?.rows;
  }

  /**
   * Gets last month summaries for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} last month summaries for all users.
   */
  async getLastMonthSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM (SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average, 
      username,
      (COUNT(CASE WHEN score <= 0 THEN 1 END)) as gameslost, 
      to_Char((now() - interval '1 month')::date, 'Month') AS lastmonth 
    FROM ConnectionScore s JOIN CONNECTIONGAME w ON w.CONNECTIONGAME = s.CONNECTIONGAME
    WHERE
      EXTRACT('MONTH' FROM w.Date) = EXTRACT('MONTH' FROM Now() - interval '1 month')
      AND EXTRACT('YEAR' FROM w.Date) = EXTRACT('YEAR' FROM Now() - interval '1 month')
      AND GuildId = $1 AND ChannelId = $2
    GROUP BY UserName
    ORDER BY Average DESC) AS summary WHERE games >= 10`, [guildId, channelId]);
    return results?.rows;
  }
}

module.exports = {ConnectionScore};
