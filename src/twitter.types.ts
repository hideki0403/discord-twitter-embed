export type TweetTemplate = {
    user?: {
        name?: string,
        username?: string,
        url?: string,
        avatar?: string,
    },
    url?: string,
    text?: string,
    likes?: number,
    retweets?: number,
    replies?: number,
    timestamp?: number,
    quoted?: {
        name?: string,
        username?: string,
        text?: string,
    },
    media: string[],
    hasVideo: boolean,
}

export type VxTwitterResponse = {
    allSameType: boolean;
    combinedMediaUrl: null;
    communityNote: null;
    conversationID: string;
    date: string;
    date_epoch: number;
    hasMedia: boolean;
    hashtags: string[];
    likes: number;
    mediaURLs: string[];
    media_extended: {
        altText: null;
        size: {
            height: number;
            width: number;
        };
        thumbnail_url: string;
        type: string;
        url: string;
    }[];
    pollData: null;
    possibly_sensitive: boolean;
    qrt: VxTwitterResponse;
    qrtURL: null | string;
    replies: number;
    retweets: number;
    text: string;
    tweetID: string;
    tweetURL: string;
    user_name: string;
    user_profile_image_url: string;
    user_screen_name: string;
}