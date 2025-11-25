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

    // 1. Movimento creations
    const movimentiCreated = db.prepare(`
      SELECT
        'movimento_created' AS event_type,
        m.created_at AS event_time,
        c.data AS consegna_data,
        p.nome AS partecipante_nome,
        u.display_name AS user_name,
        m.conto_produttore,
        m.importo_saldato,
        m.credito_lasciato,
        m.debito_lasciato,
        m.usa_credito,
        m.debito_saldato
      FROM movimenti m
      JOIN partecipanti p ON m.partecipante_id = p.id
      JOIN consegne c ON m.consegna_id = c.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.created_at IS NOT NULL
    `).all();
    events.push(...movimentiCreated);

    // 2. Movimento updates (only if updated_at differs from created_at)
    const movimentiUpdated = db.prepare(`
      SELECT
        'movimento_updated' AS event_type,
        m.updated_at AS event_time,
        c.data AS consegna_data,
        p.nome AS partecipante_nome,
        u.display_name AS user_name,
        m.conto_produttore,
        m.importo_saldato,
        m.credito_lasciato,
        m.debito_lasciato,
        m.usa_credito,
        m.debito_saldato
      FROM movimenti m
      JOIN partecipanti p ON m.partecipante_id = p.id
      JOIN consegne c ON m.consegna_id = c.id
      LEFT JOIN users u ON m.updated_by = u.id
      WHERE m.updated_at IS NOT NULL
        AND (m.created_at IS NULL OR m.updated_at != m.created_at)
    `).all();
    events.push(...movimentiUpdated);

    // 3. Consegna closures
    const consegneClosed = db.prepare(`
      SELECT
        'consegna_closed' AS event_type,
        c.chiusa_at AS event_time,
        c.data AS consegna_data,
        NULL AS partecipante_nome,
        u.display_name AS user_name
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
        u.display_name AS user_name
      FROM consegne c
      LEFT JOIN users u ON c.riaperta_by = u.id
      WHERE c.riaperta_at IS NOT NULL
    `).all();
    events.push(...consegneReopened);

    // 5. Saldo changes (partecipanti)
    const saldoChanges = db.prepare(`
      SELECT
        'saldo_updated' AS event_type,
        p.updated_at AS event_time,
        NULL AS consegna_data,
        p.nome AS partecipante_nome,
        u.display_name AS user_name,
        p.saldo
      FROM partecipanti p
      LEFT JOIN users u ON p.updated_by = u.id
      WHERE p.updated_at IS NOT NULL
    `).all();
    events.push(...saldoChanges);

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
