# discord-connections-bot
[![Build Status](https://github.com/Serk72/discord-connections-bot/actions/workflows/main.yml/badge.svg)](https://github.com/Serk72/discord-connections-bot/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/Serk72/discord-connections-bot/blob/main/LICENSE)
[![Coverage Status](https://codecov.io/github/Serk72/discord-connections-bot/branch/main/graph/badge.svg)](https://codecov.io/github/Serk72/discord-connections-bot)
[![CodeQL](https://github.com/Serk72/discord-connections-bot/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/Serk72/discord-connections-bot/actions/workflows/codeql-analysis.yml)

Discord bot for monitoring a channel for connections scores

### Config
This application is configured using https://github.com/node-config/node-config and can be changed to use `local.json` files for local config or `NODE_ENV` config files.
#### Config File

| Config name                    | JSON Type | Description | Default |
|--------------------------------|-----------|-------------|---------|
| `insultUserName`               | String    | Discord username that is specified will get a random insult generated if they are the last to complete the connections for the day. |  |
| `discordBotToken`              | String    | Bot token from discord giving the bot access to discord apis. |  |
| `postgres`                     | Object    | Database connection Info |  | 
| `postgres.password`            | String    | Password for the database   |  |
| `postgres.database`            | String    | Database name                  |  |
| `postgres.user`                | String    | Database user  | |
| `postgres.host`                | String    | Database host name, no http/https:// |  |
| `postgres.port`                | Int       | port                          | |
| `footerMessage`                | String    | If specified, footer that will be sent will all bot messages. |  |
| `userToNameMap`                | Object    | Map of of string usernames to string display names. |  |
| `applicationId`                | String    | Application Id for the discord bot, used to register commands to a discord server | |
| `giphyApiKey`                  | String/`false` | API key for giphy. used to post a gif related to the connections word for the summary. Specify as `false` to have no gif posted | |
| `tenorApiKey`                  | String/`false` | API key for tenor. Will be used above giphy as a source of gifs | |
| `autoPostSummaryChannel`       | String    |  Channel Id to which summaries will be automatically posted at the end of the day. Timer is disabled if not specified. | | 
| `autoPostHour`                 | Int       | Hour in 24 hour format at which time auto summaries will be posted. Will be in local time of the container | 22 |
| `autoPostMin`                  | Int       | Minute of the hour to post the auto summaries | 0 |  

#### Example Config
```json
{
    "insultUserName": "a discord username",
    "discordBotToken": "a discord bot token",
    "postgres": {
        "connectionString": "a connection string",
        "password": "a password",
        "database": "postgres",
        "user": "postgres",
        "host": "a hostname",
        "port": 5432
    },
    "userToNameMap": {
        "a discord username": "A name to map too"
    },
    "footerMessage": "a footer message"
}
```


### Helm

Helm instuctions to come
The current helm files are not fully configurable.
This project currently depends on an independently configured postgress database and if deployed through helm depend on existing persistance items to be set up.