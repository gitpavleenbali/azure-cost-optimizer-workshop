import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function createSqliteStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'workshop.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,login TEXT UNIQUE NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL,created_at TEXT NOT NULL,last_seen TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS single_facilitator ON users(role) WHERE role='admin';
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS progress(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,revision TEXT NOT NULL,unit TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,revision,unit));
    CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,image BLOB NOT NULL,caption TEXT NOT NULL,consent INTEGER NOT NULL,status TEXT NOT NULL,feedback TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kudos(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,PRIMARY KEY(user_id,submission_id));
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,event TEXT NOT NULL,actor TEXT,created_at TEXT NOT NULL);`);
  const transaction = action => { db.exec('BEGIN IMMEDIATE'); try { const result = action(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  return {
    db,
    kind: 'sqlite',
    close: () => db.close(),
    health: () => { db.prepare('SELECT 1').get(); return true; },
    audit: (event, actor) => db.prepare('INSERT INTO audit(event,actor,created_at) VALUES(?,?,?)').run(event, actor, new Date().toISOString()),
    hasAdmin: () => !!db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get(),
    userCount: () => db.prepare('SELECT count(*) AS count FROM users').get().count,
    addUser: user => db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run(user.id, user.name, user.login, user.password, user.salt, user.role, user.createdAt, user.createdAt),
    userByLogin: login => db.prepare('SELECT * FROM users WHERE login=?').get(login),
    participant: id => db.prepare("SELECT id FROM users WHERE id=? AND role='participant'").get(id),
    session: (token, now) => db.prepare('SELECT users.*,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(token, now),
    addSession: (token, id, csrf, expires) => transaction(() => {
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(token, id, csrf, expires);
      db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(new Date().toISOString(), id);
    }),
    revokeSession: token => db.prepare('DELETE FROM sessions WHERE token=?').run(token),
    resetPassword: (id, password, salt) => transaction(() => { db.prepare('UPDATE users SET password=?,salt=? WHERE id=?').run(password, salt, id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); }),
    progress: (id, revision) => db.prepare('SELECT unit,status,note,updated_at AS updatedAt FROM progress WHERE user_id=? AND revision=?').all(id, revision),
    saveProgress: (id, revision, unit, status, note) => db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,revision,unit) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at').run(id, revision, unit, status, note, new Date().toISOString()),
    submission: id => db.prepare('SELECT id,caption,consent,status,feedback,created_at AS createdAt FROM submissions WHERE user_id=?').get(id) ?? null,
    submissionById: id => db.prepare('SELECT * FROM submissions WHERE id=?').get(id),
    image: row => Buffer.from(row.image),
    saveSubmission: row => transaction(() => {
      const bytes = db.prepare('SELECT COALESCE(SUM(length(image)),0) AS bytes FROM submissions WHERE user_id<>?').get(row.userId).bytes;
      if (bytes + row.image.length > 500 * 1024 * 1024) throw Object.assign(new Error('Screenshot storage is full.'), { status: 507 });
      db.prepare('DELETE FROM submissions WHERE user_id=?').run(row.userId);
      db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?)').run(row.id, row.userId, row.image, row.caption, row.consent, 'pending', '', row.createdAt);
    }),
    deleteSubmission: id => db.prepare('DELETE FROM submissions WHERE user_id=?').run(id),
    deleteUser: id => db.prepare('DELETE FROM users WHERE id=?').run(id),
    approvedSubmissions: () => db.prepare("SELECT submissions.id,users.name,submissions.user_id,caption,submissions.created_at AS createdAt FROM submissions JOIN users ON users.id=submissions.user_id WHERE status='approved' AND consent=1 ORDER BY submissions.created_at DESC").all(),
    boardState: () => { const row = db.prepare("SELECT value,updated_at AS releasedAt FROM settings WHERE key='kudos-board-released'").get(); return { released: row?.value === 'true', releasedAt: row?.value === 'true' ? row.releasedAt : null }; },
    setBoardReleased: (released, actor) => { const updatedAt = new Date().toISOString(); db.prepare("INSERT INTO settings(key,value,updated_at,updated_by) VALUES('kudos-board-released',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").run(String(released), updatedAt, actor); return { released, releasedAt: released ? updatedAt : null }; },
    kudos: (submissionId, userId) => ({ kudos: db.prepare('SELECT count(*) AS count FROM kudos WHERE submission_id=?').get(submissionId).count, applauded: !!db.prepare('SELECT 1 FROM kudos WHERE submission_id=? AND user_id=?').get(submissionId, userId) }),
    toggleKudos: (submissionId, userId) => transaction(() => { const exists = db.prepare('SELECT 1 FROM kudos WHERE submission_id=? AND user_id=?').get(submissionId, userId); if (exists) db.prepare('DELETE FROM kudos WHERE submission_id=? AND user_id=?').run(submissionId, userId); else db.prepare('INSERT INTO kudos VALUES(?,?)').run(userId, submissionId); }),
    participants: () => db.prepare("SELECT id,name,created_at AS createdAt,last_seen AS lastSeen FROM users WHERE role='participant' ORDER BY created_at DESC").all(),
    review: (id, status, feedback) => db.prepare('UPDATE submissions SET status=?,feedback=? WHERE id=?').run(status, feedback, id),
  };
}