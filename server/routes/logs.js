const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Require authentication and admin for all logs routes
router.use(requireAuth);
router.use(requireAdmin);

// Get activity log with pagination
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  console.log(`[LOGS] ${timestamp} - GET request for activity log (page: ${page}, limit: ${limit})`);

  try {
    const events = [];

    // 1. Movimento creations (with audit tracking)
    const movimentiCreated = db.prepare(`
      SELECT
        'movimento_created' AS event_type,
        m.created_at AS event_time,
        c.data AS consegna_data,
        p.display_name AS partecipante_nome,
        u.username AS user_name,
        m.conto_produttore,
        m.importo_saldato,
        m.credito_lasciato,
        m.debito_lasciato,
        m.usa_credito,
        m.debito_saldato
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
      JOIN consegne c ON m.consegna_id = c.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.created_at IS NOT NULL
    `).all();
    events.push(...movimentiCreated);

    // 1b. Historical movimenti (before audit tracking - use consegna date as event time)
    const movimentiHistorical = db.prepare(`
      SELECT
        'movimento_historical' AS event_type,
        c.data || ' 00:00:00' AS event_time,
        c.data AS consegna_data,
        p.display_name AS partecipante_nome,
        NULL AS user_name,
        m.conto_produttore,
        m.importo_saldato,
        m.credito_lasciato,
        m.debito_lasciato,
        m.usa_credito,
        m.debito_saldato
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
      JOIN consegne c ON m.consegna_id = c.id
      WHERE m.created_at IS NULL
    `).all();
    events.push(...movimentiHistorical);

    // 2. Movimento updates (historical, before activity_logs tracking)
    // Only include if no corresponding movimento_changed entry exists for same user/consegna
    const movimentiUpdated = db.prepare(`
      SELECT
        'movimento_updated' AS event_type,
        m.updated_at AS event_time,
        c.data AS consegna_data,
        p.display_name AS partecipante_nome,
        u.username AS user_name,
        m.conto_produttore,
        m.importo_saldato,
        m.credito_lasciato,
        m.debito_lasciato,
        m.usa_credito,
        m.debito_saldato
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
      JOIN consegne c ON m.consegna_id = c.id
      LEFT JOIN users u ON m.updated_by = u.id
      WHERE m.updated_at IS NOT NULL
        AND (m.created_at IS NULL OR m.updated_at != m.created_at)
        AND NOT EXISTS (
          SELECT 1 FROM activity_logs al
          WHERE al.event_type = 'movimento_changed'
            AND al.target_user_id = m.partecipante_id
            AND al.details LIKE '%consegna: ' || c.data || ',%'
        )
    `).all();
    events.push(...movimentiUpdated);

    // 3. Consegna closures
    const consegneClosed = db.prepare(`
      SELECT
        'consegna_closed' AS event_type,
        c.chiusa_at AS event_time,
        c.data AS consegna_data,
        NULL AS partecipante_nome,
        u.username AS user_name
      FROM consegne c
      LEFT JOIN users u ON c.chiusa_by = u.id
      WHERE c.chiusa = 1 AND c.chiusa_at IS NOT NULL
    `).all();
    events.push(...consegneClosed);

    // 4. Consegna reopens
    const consegneReopened = db.prepare(`
      SELECT
        'consegna_reopened' AS event_type,
        c.riaperta_at AS event_time,
        c.data AS consegna_data,
        NULL AS partecipante_nome,
        u.username AS user_name
      FROM consegne c
      LEFT JOIN users u ON c.riaperta_by = u.id
      WHERE c.riaperta_at IS NOT NULL
    `).all();
    events.push(...consegneReopened);

    // 5. User management events (from activity_logs)
    const userManagementEvents = db.prepare(`
      SELECT
        al.event_type,
        al.created_at AS event_time,
        NULL AS consegna_data,
        t.display_name AS partecipante_nome,
        a.username AS user_name,
        al.details
      FROM activity_logs al
      LEFT JOIN users t ON al.target_user_id = t.id
      LEFT JOIN users a ON al.actor_user_id = a.id
    `).all();
    events.push(...userManagementEvents);

    // Sort all events by event_time DESC
    events.sort((a, b) => {
      if (!a.event_time) return 1;
      if (!b.event_time) return -1;
      return new Date(b.event_time) - new Date(a.event_time);
    });

    // Pagination
    const total = events.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedEvents = events.slice(offset, offset + limit);

    console.log(`[LOGS] ${timestamp} - Retrieved ${paginatedEvents.length} events (total: ${total})`);

    res.json({
      success: true,
      events: paginatedEvents,
      page,
      limit,
      total,
      totalPages
    });
  } catch (error) {
    console.error(`[LOGS] ${timestamp} - Error fetching activity log:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
