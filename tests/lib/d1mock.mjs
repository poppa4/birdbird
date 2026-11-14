/* A small Cloudflare D1 stand-in on Node's built-in SQLite (node:sqlite), close enough to catch SQL and binding bugs:
   prepare().bind().first()/all()/run(), batch() in one transaction, and D1's refusal of `undefined` bindings. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function makeD1(migrationsDir) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  if (migrationsDir) for (const f of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  const log = [];
  class Stmt {
    constructor(sql, args) { this.sql = sql; this.args = args || []; }
    bind(...a) {
      a.forEach((v, i) => { if (v === undefined) throw new Error('D1_TYPE_ERROR: Type \'undefined\' not supported for value at index ' + i + ' in ' + this.sql.slice(0, 60)); });
      return new Stmt(this.sql, a.map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v));
    }
    _p() { log.push(this.sql.replace(/\s+/g, ' ').trim()); return db.prepare(this.sql); }
    async first(col) { const r = this._p().get(...this.args); const o = r ? Object.assign({}, r) : null; return col ? (o ? o[col] : null) : o; }
    async all() { const rows = this._p().all(...this.args).map(r => Object.assign({}, r)); return { success: true, results: rows, meta: {} }; }
    async run() {
      if (/\bRETURNING\b/i.test(this.sql)) { const rows = this._p().all(...this.args); return { success: true, results: rows, meta: { changes: rows.length } }; }
      const r = this._p().run(...this.args); return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
  }
  let queue = Promise.resolve();   // D1 runs each batch atomically on the server; here batches wait for each other
  return {
    raw: db, log,
    prepare: sql => new Stmt(sql),
    batch(stmts) {
      const run = async () => {
        db.exec('BEGIN');
        try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; }
        catch (e) { db.exec('ROLLBACK'); throw e; }
      };
      const p = queue.then(run, run); queue = p.catch(() => {}); return p;
    },
    async exec(sql) { db.exec(sql); return { count: 1 }; }
  };
}
