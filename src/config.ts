import fs from 'node:fs'
import yaml from 'js-yaml'
import appRootPath from 'app-root-path'
import deepmerge from 'deepmerge'

const configPath = appRootPath.resolve('./config.yaml')

if (!fs.existsSync(configPath)) {
    console.error('config.yaml not found. Please create one.')
    process.exit(1)
}

const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, any>

const fallbackConfig = {
    useVxTwitter: false as boolean,
    vxTwitterApiUrl: null as string | null,
    retryLimit: 3 as number,
    discordToken: null as string | null,
    externalEmoji: {
        like: null as string | null,
        retweet: null as string | null,
        reply: null as string | null,
    },
} as const

export default deepmerge(fallbackConfig, config) as typeof fallbackConfig