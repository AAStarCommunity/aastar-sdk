// SqliteEventStore: SQLite-backed implementation of EventStore using better-sqlite3

import Database from 'better-sqlite3';
import type { EventStore, NostrEvent, EventFilter } from './EventStore.js';

const MAX_QUERY_LIMIT = 500;
const DEFAULT_QUERY_LIMIT = 100;

export class SqliteEventStore implements EventStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id         TEXT PRIMARY KEY,
        pubkey     TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind       INTEGER NOT NULL,
        tags       TEXT NOT NULL,
        content    TEXT NOT NULL,
        sig        TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_kind_created_at
        ON events(kind, created_at);

      CREATE INDEX IF NOT EXISTS idx_events_pubkey_created_at
        ON events(pubkey, created_at);
    `);
  }

  save(event: NostrEvent): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig)
      VALUES (@id, @pubkey, @created_at, @kind, @tags, @content, @sig)
    `);
    stmt.run({
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: JSON.stringify(event.tags),
      content: event.content,
      sig: event.sig,
    });
  }

  query(filter: EventFilter): NostrEvent[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.ids && filter.ids.length > 0) {
      const placeholders = filter.ids.map((_, i) => `@id${i}`).join(', ');
      conditions.push(`id IN (${placeholders})`);
      filter.ids.forEach((id, i) => { params[`id${i}`] = id; });
    }

    if (filter.authors && filter.authors.length > 0) {
      const placeholders = filter.authors.map((_, i) => `@author${i}`).join(', ');
      conditions.push(`pubkey IN (${placeholders})`);
      filter.authors.forEach((a, i) => { params[`author${i}`] = a; });
    }

    if (filter.kinds && filter.kinds.length > 0) {
      const placeholders = filter.kinds.map((_, i) => `@kind${i}`).join(', ');
      conditions.push(`kind IN (${placeholders})`);
      filter.kinds.forEach((k, i) => { params[`kind${i}`] = k; });
    }

    if (filter.since !== undefined) {
      conditions.push('created_at >= @since');
      params['since'] = filter.since;
    }

    if (filter.until !== undefined) {
      conditions.push('created_at <= @until');
      params['until'] = filter.until;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filter.limit ?? DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    const sql = `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT @limit`;
    params['limit'] = limit;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params) as Array<{
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string;
      content: string;
      sig: string;
    }>;

    let events = rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags) as string[][],
    }));

    // Post-filter tag queries (#e, #p) — SQLite doesn't index JSON arrays
    if (filter['#e'] && filter['#e'].length > 0) {
      const eSet = new Set(filter['#e']);
      events = events.filter(ev =>
        ev.tags.some(tag => tag[0] === 'e' && eSet.has(tag[1]))
      );
    }

    if (filter['#p'] && filter['#p'].length > 0) {
      const pSet = new Set(filter['#p']);
      events = events.filter(ev =>
        ev.tags.some(tag => tag[0] === 'p' && pSet.has(tag[1]))
      );
    }

    return events;
  }

  has(id: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM events WHERE id = @id');
    const row = stmt.get({ id }) as { cnt: number };
    return row.cnt > 0;
  }

  close(): void {
    this.db.close();
  }
}
