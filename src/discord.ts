import { Client, IntentsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, Partials, Message, PartialMessage, APIEmbed, APIMessageComponent, EmbedBuilder } from 'discord.js'
import { getTweet } from './twitter.js'
import * as database from './database.js'
import config from './config.js'

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ],
    partials: [
        Partials.Message,
    ],
})

const embedsWatcher = new Map<string, number>()

client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`)
})

client.on('messageCreate', async (msg) => {
    const tweetIds = getTweetIds(msg)
    if (!tweetIds) return

    embedsWatcher.set(msg.id, Date.now())
    console.log('Message created:', msg.id)

    const contents = await createEmbed(tweetIds)
    if (!contents) return

    const res = await msg.reply({
        embeds: contents.embeds.map(x => x.toJSON()),
        components: contents.components.map(x => x.toJSON()),
        allowedMentions: {
            repliedUser: false
        }
    })

    await suppressEmbeds(msg)

    database.insert(msg.id, res.id, Array.from(tweetIds))
})

client.on('messageDelete', (msg) => deleteEmbed(msg))

client.on('messageUpdate', async (_, msg) => {
    const newTweetIds = getTweetIds(msg)

    if (newTweetIds && msg.embeds.some(embed => embed.footer?.text === 'Twitter')) {
        embedsWatcher.set(msg.id, Date.now())
    }

    suppressEmbeds(msg)

    const message = database.get(msg.id)
    if (!message) return

    const oldTweetIds = message.tweetIds.split(',')
    if (!newTweetIds) return deleteEmbed(msg)

    const isSameContent = oldTweetIds.every(x => newTweetIds.has(x))
    if (oldTweetIds.length === newTweetIds.size && isSameContent) return console.log('Skipping message update...')

    if (msg.embeds.length) return deleteEmbed(msg)

    const contents = await createEmbed(newTweetIds)
    if (!contents) return deleteEmbed(msg)

    const reply = await msg.channel.messages.fetch(message.self)
    if (!reply) return

    await reply.edit({
        embeds: contents.embeds,
        components: contents.components,
    })

    database.update(msg.id, Array.from(newTweetIds))
    console.log('Message updated:', msg.id)
})

function getTweetIds(msg: Message | PartialMessage) {
    const urls = msg.content?.match(/(https?:\/\/[-_.a-zA-Z0-9\/]+)/g)
    const tweetIds = new Set<string>()

    if (!urls?.length) return null
    for (const url of urls) {
        const parsed = url.match(/(x|twitter).com\/(?<user>[0-9a-zA-Z_]{1,15})\/status\/(?<id>[0-9]+)/)
        if (parsed?.groups?.id) tweetIds.add(parsed.groups.id)
    }

    if (!tweetIds.size) return null
    return tweetIds
}

async function createEmbed(content: Message | PartialMessage | Set<string>) {
    const tweetIds = content instanceof Set ? content : getTweetIds(content)
    if (!tweetIds) return null

    const baseEmbeds: EmbedBuilder[] = []
    const baseComponents: ActionRowBuilder<ButtonBuilder>[] = []

    const useExternalEmoji = (config.externalEmoji.like && config.externalEmoji.retweet && config.externalEmoji.reply) != null

    for (const tweetId of tweetIds) {
        console.log(`Detected tweet: ${tweetId}`)

        const tweet = await getTweet(tweetId)
        if (!tweet) continue

        let description = tweet.text ?? ''
        const tweetUrl = tweet.url ?? 'https://twitter.com/'

        const quote = tweet.quoted
        if (quote) {
            description += `\n\n>>> ${quote.name ?? 'Unknown'} (@${quote.username ?? '----'}): ${quote.text}`
        }

        const embeds: EmbedBuilder[] = []
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${tweet.user?.name ?? 'Unknown'} (@${tweet.user?.username ?? '----'})`,
                iconURL: tweet.user?.avatar ?? 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
                url: tweet.user?.url ?? 'https://twitter.com/',
            })
            .setURL(tweetUrl)
            .setFooter({
                text: 'Twitter',
                iconURL: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
            })
            .setTimestamp(tweet.timestamp ? new Date(tweet.timestamp * 1000) : undefined)
            .setColor(0x1da1f2)

        if (useExternalEmoji) {
            description += `\n\n${config.externalEmoji.like}${tweet.likes?.toString() ?? '0'}  ${config.externalEmoji.retweet}${tweet.retweets?.toString() ?? '0'}  ${config.externalEmoji.reply}${tweet.replies?.toString() ?? '0'}`
        } else {
            embed.addFields([{
                name: 'いいね',
                value: tweet.likes?.toString() ?? '0',
                inline: true,
            }, {
                name: 'リツイート',
                value: tweet.retweets?.toString() ?? '0',
                inline: true,
            }])
        }

        embed.setDescription(description)

        for (let i = 0; i < tweet.media.length; i++) {
            if (i === 0) {
                embed.setImage(tweet.media[i])
            } else {
                embeds.push(new EmbedBuilder().setURL(tweetUrl).setImage(tweet.media[i]))
            }
        }

        if (tweet.hasVideo) {
            const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('動画をTwitterで見る').setURL(tweetUrl)
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
            baseComponents.push(row)
        }

        embeds.unshift(embed)
        baseEmbeds.push(...embeds)
    }

    return {
        embeds: baseEmbeds,
        components: baseComponents,
    }
}

async function deleteEmbed(msg: Message | PartialMessage) {
    const messages = database.getAll(msg.id)
    if (!messages.length) return

    for (const message of messages) {
        try {
            await msg.channel.messages.fetch(message.self).then(x => x.delete())
        } catch (e) {
            console.error('Failed to delete message:')
            console.error(e)
        }
    }

    database.remove(msg.id)
}

async function suppressEmbeds(msg: Message | PartialMessage) {
    if (!embedsWatcher.has(msg.id)) return

    embedsWatcher.delete(msg.id)
    try {
        await msg.suppressEmbeds(true)
    } catch (e) {
        console.error('Failed to suppress embeds. Please check the bots permissions.')
        console.error(e)
    }

    embedsWatcher.forEach((timestamp, id) => {
        if (Date.now() - timestamp > 1000 * 30) {
            embedsWatcher.delete(id)
        }
    })
}

setInterval(() => {
    client.user?.setActivity(`Embedding ${database.count()} tweets`)
}, 1000 * 60 * 5)

export default client