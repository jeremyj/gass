'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createConsegna, createTurno, clearTurni, clearConsegne } = require('../helpers/seed');
const { apertura } = require('../../server/services/apertura');
const request = require('supertest');

const TODAY = '2026-10-09'; // a Friday

beforeEach(() => {
  clearConsegne(db);
  clearTurni(db);
});

describe('apertura', () => {
  it('opens today without turni', () => {
    expect(apertura(db, TODAY)).toEqual({ data: TODAY, aperte: [] });
  });

  it('opens the last turno while it has no consegna', () => {
    createTurno(db, { settimana: '2026-09-29' });
    createTurno(db, { settimana: '2026-10-06' });
    createTurno(db, { settimana: '2026-10-13' }); // future: ignored
    expect(apertura(db, TODAY).data).toBe('2026-10-06');
  });

  it('opens the last turno while its consegna is open', () => {
    createTurno(db, { settimana: '2026-10-06' });
    const id = createConsegna(db, { data: '2026-10-06' });
    expect(apertura(db, TODAY)).toEqual({ data: '2026-10-06', aperte: [{ id, data: '2026-10-06' }] });
  });

  it('opens today once the last turno is closed', () => {
    createTurno(db, { settimana: '2026-10-06' });
    createConsegna(db, { data: '2026-10-06', chiusa: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('opens a turno today on today', () => {
    createTurno(db, { settimana: TODAY });
    createConsegna(db, { data: '2026-10-06', chiusa: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('uses the real day of a moved turno', () => {
    createTurno(db, { settimana: '2026-10-06', data: '2026-10-07' });
    expect(apertura(db, TODAY).data).toBe('2026-10-07');
  });

  it('skips weeks without consegna (saltata)', () => {
    createTurno(db, { settimana: '2026-09-29' });
    createConsegna(db, { data: '2026-09-29', chiusa: 1 });
    createTurno(db, { settimana: '2026-10-06', saltata: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('lists every open consegna, oldest first', () => {
    const old = createConsegna(db, { data: '2026-09-22' });
    createConsegna(db, { data: '2026-09-29', chiusa: 1 });
    const recent = createConsegna(db, { data: '2026-10-06' });
    expect(apertura(db, TODAY).aperte).toEqual([{ id: old, data: '2026-09-22' }, { id: recent, data: '2026-10-06' }]);
  });
});

describe('GET /api/consegna/apertura', () => {
  let agent;
  beforeAll(async () => {
    const { app } = setupTestApp();
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  });

  it('is not taken for a date by GET /:date', async () => {
    createTurno(db, { settimana: '2020-01-07' });
    const res = await agent.get('/api/consegna/apertura');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('2020-01-07');
    expect(res.body.aperte).toEqual([]);
  });
});
