import discord from './discord.js'
import config from './config.js'

if (!config.discordToken) {
    console.error('Please set the discord bot token in config.yaml')
    process.exit(1)
}

discord.login(config.discordToken)