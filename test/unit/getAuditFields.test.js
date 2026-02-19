'use strict';

// Note: auth.js requires the database module, but db is not used by getAuditFields.
// With NODE_ENV=test, database.js exports { createDatabase } (not a DB instance),
// so db is { createDatabase } here — requireAuth/requireAdmin would fail if called,
// but getAuditFields is a pure function that doesn't touch db.
const { getAuditFields } = require('../../server/middleware/auth');

describe('getAuditFields', () => {
  it('returns create fields with userId from session', () => {
    const req = { session: { userId: 42 }, user: undefined };
    const fields = getAuditFields(req, 'create');
    expect(fields.created_by).toBe(42);
    expect(fields.updated_by).toBe(42);
    expect(fields.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fields.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns update fields with userId from session', () => {
    const req = { session: { userId: 7 }, user: undefined };
    const fields = getAuditFields(req, 'update');
    expect(fields.updated_by).toBe(7);
    expect(fields.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fields.created_by).toBeUndefined();
    expect(fields.created_at).toBeUndefined();
  });

  it('falls back to req.user.id when session.userId is missing', () => {
    const req = { session: undefined, user: { id: 99 } };
    const fields = getAuditFields(req, 'create');
    expect(fields.created_by).toBe(99);
  });

  it('returns null userId when no session and no user', () => {
    const req = { session: undefined, user: undefined };
    const fields = getAuditFields(req, 'create');
    expect(fields.created_by).toBeNull();
    expect(fields.updated_by).toBeNull();
  });

  it('defaults operation to create', () => {
    const req = { session: { userId: 1 } };
    const fields = getAuditFields(req);
    expect(fields.created_by).toBe(1);
    expect(fields.created_at).toBeDefined();
  });

  it('throws on invalid operation', () => {
    const req = { session: { userId: 1 } };
    expect(() => getAuditFields(req, 'delete')).toThrow('Invalid audit operation');
  });
});
