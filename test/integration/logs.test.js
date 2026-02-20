'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, createMovimento, clearConsegne, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let app, adminAgent;

beforeAll(() => {
  ({ app } = setupTestApp());
  adminAgent = request.agent(app);
  return adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
});

beforeEach(() => {
  clearConsegne(db);
  clearNonAdminUsers(db);
});

describe('GET /api/logs', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.get('/api/logs');
    expect(res.status).toBe(403);
  });

  it('returns empty events and pagination metadata when no data', async () => {
    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
  });

  it('caps limit at 200', async () => {
    const res = await adminAgent.get('/api/logs?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it('includes movement events from movimenti table', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const consegnaId = createConsegna(db, { data: '2026-02-19' });
    createMovimento(db, { consegnaId, partecipanteId: userId, creditoLasciato: 10, createdAt: new Date().toISOString() });

    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.events.some(e => e.event_type === 'movimento_created')).toBe(true);
  });

  it('includes virtual consegna_closed events', async () => {
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });
    db.prepare('UPDATE consegne SET chiusa_at = ? WHERE id = ?').run(new Date().toISOString(), consegnaId);

    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.events.some(e => e.event_type === 'consegna_closed')).toBe(true);
  });

  it('includes activity_log events (user_created)', async () => {
    db.prepare("INSERT INTO activity_logs (event_type, actor_user_id, details) VALUES ('user_created', 1, 'test')").run();

    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.events.some(e => e.event_type === 'user_created')).toBe(true);
  });

  it('populates consegna_data via consegna_id for movimento_changed events', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const consegnaId = createConsegna(db, { data: '2026-02-18' });
    createMovimento(db, { consegnaId, partecipanteId: userId, contoProduttore: 10, createdAt: new Date().toISOString() });

    // Insert a movimento_changed log with consegna_id (new format)
    db.prepare(`
      INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, consegna_id, created_at)
      VALUES ('movimento_changed', ?, ?, ?, ?, ?)
    `).run(userId, userId, 'conto: 10 → 20', consegnaId, new Date().toISOString());

    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);

    const changedEvent = res.body.events.find(e => e.event_type === 'movimento_changed');
    expect(changedEvent).toBeDefined();
    expect(changedEvent.consegna_data).toBe('2026-02-18');
    // Details should NOT contain the consegna prefix (new format)
    expect(changedEvent.details).not.toContain('consegna:');
  });

  it('includes consegna_created events', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const consegnaId = createConsegna(db, { data: '2026-02-17' });

    db.prepare(`
      INSERT INTO activity_logs (event_type, actor_user_id, consegna_id, details, created_at)
      VALUES ('consegna_created', ?, ?, ?, ?)
    `).run(userId, consegnaId, 'consegna: 2026-02-17', new Date().toISOString());

    const res = await adminAgent.get('/api/logs');
    expect(res.status).toBe(200);

    const createdEvent = res.body.events.find(e => e.event_type === 'consegna_created');
    expect(createdEvent).toBeDefined();
    expect(createdEvent.consegna_data).toBe('2026-02-17');
  });

  it('paginates results', async () => {
    // Create several activity log entries
    for (let i = 0; i < 5; i++) {
      db.prepare("INSERT INTO activity_logs (event_type, actor_user_id, details) VALUES ('user_created', 1, ?)").run(`entry ${i}`);
    }

    const res1 = await adminAgent.get('/api/logs?page=1&limit=3');
    expect(res1.status).toBe(200);
    expect(res1.body.events.length).toBeLessThanOrEqual(3);

    const res2 = await adminAgent.get('/api/logs?page=2&limit=3');
    expect(res2.status).toBe(200);
    // Both pages together should cover all events
    expect(res1.body.total).toBeGreaterThanOrEqual(5);
  });
});
