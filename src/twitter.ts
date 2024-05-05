import fetch from 'node-fetch'
import { Scraper, type Tweet } from '@the-convocation/twitter-scraper'
import type { TweetTemplate, VxTwitterResponse } from './twitter.types.js'
import config from './config.js'

const scraper = new Scraper()

export async function getTweet(id: string) {
    return config.useVxTwitter ? fetchTweetFromVxTwitter(id) : fetchTweetFromScraper(id)
}

async function fetchTweetFromScraper(id: string): Promise<TweetTemplate | null> {
    let tweet: Tweet | null = null
    let retry = 0

    while (retry++ < config.retryLimit) {
        try {
            tweet = await scraper.getTweet(id)
        } catch (e) {
            console.log(`Failed to fetch tweet. Retrying... (${retry} / ${config.retryLimit})`)
        }

        if (!tweet) {
            await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
            break
        }
    }

    if (!tweet) return null

    const author = tweet.username ? await scraper.getProfile(tweet.username) : null

    return {
        user: {
            name: tweet.name ?? author?.name,
            username: tweet.username ?? author?.username,
            url: author?.url,
            avatar: author?.avatar,
        },
        url: tweet.permanentUrl,
        text: htmlNormalization(tweet.html),
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        timestamp: tweet.timestamp,
        quoted: tweet.quotedStatus ? {
            name: tweet.quotedStatus.name,
            username: tweet.quotedStatus.username,
            text: htmlNormalization(tweet.quotedStatus.html),
        } : undefined,
        media: [...tweet.photos.map(x => x.url), ...tweet.videos.map(x => x.preview)],
        hasVideo: tweet.videos.length > 0,
    }
}

async function fetchTweetFromVxTwitter(id: string): Promise<TweetTemplate | null> {
    if (!config.vxTwitterApiUrl) return null
    const res = await fetch(`${config.vxTwitterApiUrl}${config.vxTwitterApiUrl.endsWith('/') ? '' : '/'}tweet/status/${id}`)
    if (!res.ok) return null
    const tweet = await res.json() as VxTwitterResponse

    return {
        user: {
            name: tweet.user_name,
            username: tweet.user_screen_name,
            url: `https://twitter.com/${tweet.user_screen_name}`,
            avatar: tweet.user_profile_image_url,
        },
        url: tweet.tweetURL,
        text: tweet.text.replace(/https?:\/\/t.co\/[a-zA-Z0-9]+/g, ''),
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        timestamp: tweet.date_epoch,
        quoted: tweet.qrt ? {
            name: tweet.qrt.user_name,
            username: tweet.qrt.user_screen_name,
            text: tweet.qrt.text,
        } : undefined,
        media: tweet.media_extended.map(x => x.thumbnail_url),
        hasVideo: tweet.media_extended.some(x => x.type === 'video'),
    }
}

function htmlNormalization(html?: string) {
    if (!html) return
    return html
        .replace(/<br>/g, '\n')
        .replace(/<a href=".*?">(?<hashtag>#.*?)<\/a>/g, '$<hashtag>')
        .replace(/<a href="(?<href>.*?)">(?<mention>@.*?)<\/a>/g, '[$<mention>]($<href>)')
        .replace(/<a href="(?<href>.*?)">.*?<\/a>/g, '$<href>')
        .replace(/https?:\/\/t.co\/[a-zA-Z0-9]+/g, '')
        .replace(/<img .*?>/g, '')
}