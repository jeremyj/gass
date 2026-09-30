const db = require('../config/database');

// Insert one activity_logs row (created_at is an ISO UTC timestamp, as for all audit times)
function logActivity({
  eventType,
  targetUserId = null,
  actorUserId,
  details,
  consegnaId = null,
  createdAt = new Date().toISOString()
}) {
  db.prepare(`
    INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, consegna_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(eventType, targetUserId, actorUserId, details, consegnaId, createdAt);
}

module.exports = { logActivity };
