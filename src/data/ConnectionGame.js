const {Pool} = require('pg');
const config = require('config');
const DATABASE_CONFIG = config.get('postgres');
/**
 * Data Access Layer for the ConnectionGame Table
 */
class ConnectionGame {
  pool;
  static _instance;
  /**
   * Singleton instance.
   * @return {WordleGame} the singleton instance
   */
  static getInstance() {
    if (!ConnectionGame._instance) {
      ConnectionGame._instance = new ConnectionGame();
    }
    return ConnectionGame._instance;
  }
  /**
   * Constructor
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
    ConnectionGame (
      Id serial PRIMARY KEY,
      ConnectionGame INT NOT NULL UNIQUE,
      Category1 VARCHAR (255),
      Category2 VARCHAR (255),
      Category3 VARCHAR (255),
      Category4 VARCHAR (255),
      JsonGameInfo JSONB,
      SummaryPosted BOOLEAN,
      Date TIMESTAMP);`;
    this.pool.query(tablesSQL, (err, res) => {
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
   * Gets a connection game from the database if it exists.
   * @param {*} connectionGame game number to look up.
   * @return {*} the connection game row if it exits or null.
   */
  async getConnectionGame(connectionGame) {
    try {
      const results = await this.pool.query('SELECT * FROM ConnectionGame WHERE ConnectionGame = $1', [connectionGame]);
      return results?.rows?.[0];
    } catch (ex) {
      console.log(ex);
      throw ex;
    }
  }

  /**
   * Finds the latest game recorded in the database.
   * @return {*} the latest game recorded in the database.
   */
  async getLatestGame() {
    const results = await this.pool.query('SELECT * FROM ConnectionGame ORDER BY ConnectionGame DESC LIMIT 1', []);
    return results?.rows?.[0]?.connectiongame;
  }

  /**
   * Finds the latest game recorded in the database.
   * @return {*} the latest game recorded in the database.
   */
  async getLatestGameSummaryPosted() {
    const results = await this.pool.query('SELECT * FROM ConnectionGame ORDER BY ConnectionGame DESC LIMIT 1', []);
    return results?.rows?.[0]?.summaryposted;
  }

  /**
   * Creates a connection game entry.
   * @param {*} connectionGame The game number to add.
   * @param {*} timestamp The timestamp of when the game was added.
   */
  async createConnectionGame(connectionGame, timestamp) {
    await this.pool.query(`INSERT INTO ConnectionGame(ConnectionGame, Date) VALUES ($1, to_timestamp($2))`, [connectionGame, timestamp / 1000]);
  }

  /**
   * Gets all connection game dates.
   */
  async getConnectionGames() {
    const results = await this.pool.query(`SELECT to_char(date, 'yyyy-MM-dd') as day FROM ConnectionGame`, []);
    return results.rows;
  }

  /**
   * Adds the solution to the connections game.
   * @param {*} game connections Game number.
   * @param {*} jsonGameInfo solution to the connections.
   */
  async addGameInfo(game, jsonGameInfo) {
    const category1 = jsonGameInfo.categories[0].title;
    const category2 = jsonGameInfo.categories[1].title;
    const category3 = jsonGameInfo.categories[2].title;
    const category4 = jsonGameInfo.categories[3].title;
    await this.pool.query(`UPDATE ConnectionGame SET JsonGameInfo = $1, Category1 = $2, Category2 = $3, Category3 = $4, Category4 = $5 WHERE ConnectionGame = $6`,
        [jsonGameInfo, category1, category2, category3, category4, game]);
  }

  /**
   * Marks the summary as posted.
   * @param {*} game connections Game number.
   */
  async summaryPosted(game) {
    await this.pool.query(`UPDATE ConnectionGame SET SummaryPosted = TRUE WHERE ConnectionGame = $1`, [game]);
  }
}
module.exports = {ConnectionGame};
