import sqlite3 from 'better-sqlite3'

const db = sqlite3('embeds.db')
db.prepare('CREATE TABLE IF NOT EXISTS embeds(parent TEXT, self TEXT, tweetIds TEXT, createdAt INTEGER)').run()

type EmbedRecord = {
    parent: string
    self: string
    tweetIds: string
    createdAt: number
}

export function insert(parent: string, self: string, tweetIds: string[]) {
    db.prepare('INSERT INTO embeds VALUES (?, ?, ?, ?)').run(parent, self, tweetIds.join(','), Date.now())
}

export function update(parent: string, tweetIds: string[]) {
    db.prepare('UPDATE embeds SET tweetIds = ? WHERE parent = ?').run(tweetIds.join(','), parent)
}

export function getAll(parent: string) {
    return db.prepare('SELECT * FROM embeds WHERE parent = ?').all(parent) as EmbedRecord[]
}

export function get(parent: string) {
    return db.prepare('SELECT * FROM embeds WHERE parent = ?').get(parent) as EmbedRecord
}

export function remove(parent: string) {
    db.prepare('DELETE FROM embeds WHERE parent = ?').run(parent)
}

export function count() {
    return db.prepare('SELECT COUNT(*) FROM embeds').pluck().get() as number
}
