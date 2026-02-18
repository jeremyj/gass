const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Require authentication and admin for all logs routes
router.use(requireAuth);
router.use(requireAdmin);

// Get activity log with pagination using UNION ALL for efficiency
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;

  console.log(`[LOGS] ${timestamp} - GET request for activity log (page: ${page}, limit: ${limit})`);

  try {
    // Count total events
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM (
        SELECT m.created_at AS event_time FROM movimenti m WHERE m.created_at IS NOT NULL
        UNION ALL
        SELECT c.data || ' 00:00:00' AS event_time FROM movimenti m
          JOIN consegne c ON m.consegna_id = c.id WHERE m.created_at IS NULL
        UNION ALL
        SELECT m.updated_at AS event_time FROM movimenti m
          JOIN consegne c ON m.consegna_id = c.id
          WHERE m.updated_at IS NOT NULL
            AND (m.created_at IS NULL OR m.updated_at != m.created_at)
            AND NOT EXISTS (
              SELECT 1 FROM activity_logs al
              WHERE al.event_type = 'movimento_changed'
                AND al.target_user_id = m.partecipante_id
                AND al.details LIKE '%consegna: ' || c.data || ',%'
            )
        UNION ALL
        SELECT c.chiusa_at AS event_time FROM consegne c WHERE c.chiusa = 1 AND c.chiusa_at IS NOT NULL
        UNION ALL
        SELECT c.riaperta_at AS event_time FROM consegne c WHERE c.riaperta_at IS NOT NULL
        UNION ALL
        SELECT al.created_at AS event_time FROM activity_logs al
      ) combined
    `).get();
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated events with UNION ALL
    const events = db.prepare(`
      SELECT * FROM (
        SELECT
          'movimento_created' AS event_type,
          m.created_at AS event_time,
          c.data AS consegna_data,
          p.display_name AS partecipante_nome,
          u.username AS user_name,
          m.conto_produttore, m.importo_saldato,
          m.credito_lasciato, m.debito_lasciato,
          m.usa_credito, m.debito_saldato,
          NULL AS details
        FROM movimenti m
        JOIN users p ON m.partecipante_id = p.id
        JOIN consegne c ON m.consegna_id = c.id
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.created_at IS NOT NULL

        UNION ALL

        SELECT
          'movimento_historical' AS event_type,
          c.data || ' 00:00:00' AS event_time,
          c.data AS consegna_data,
          p.display_name AS partecipante_nome,
          NULL AS user_name,
          m.conto_produttore, m.importo_saldato,
          m.credito_lasciato, m.debito_lasciato,
          m.usa_credito, m.debito_saldato,
          NULL AS details
        FROM movimenti m
        JOIN users p ON m.partecipante_id = p.id
        JOIN consegne c ON m.consegna_id = c.id
        WHERE m.created_at IS NULL

        UNION ALL

        SELECT
          'movimento_updated' AS event_type,
          m.updated_at AS event_time,
          c.data AS consegna_data,
          p.display_name AS partecipante_nome,
          u.username AS user_name,
          m.conto_produttore, m.importo_saldato,
          m.credito_lasciato, m.debito_lasciato,
          m.usa_credito, m.debito_saldato,
          NULL AS details
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

        UNION ALL

        SELECT
          'consegna_closed' AS event_type,
          c.chiusa_at AS event_time,
          c.data AS consegna_data,
          NULL AS partecipante_nome,
          u.username AS user_name,
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL AS details
        FROM consegne c
        LEFT JOIN users u ON c.chiusa_by = u.id
        WHERE c.chiusa = 1 AND c.chiusa_at IS NOT NULL

        UNION ALL

        SELECT
          'consegna_reopened' AS event_type,
          c.riaperta_at AS event_time,
          c.data AS consegna_data,
          NULL AS partecipante_nome,
          u.username AS user_name,
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL AS details
        FROM consegne c
        LEFT JOIN users u ON c.riaperta_by = u.id
        WHERE c.riaperta_at IS NOT NULL

        UNION ALL

        SELECT
          al.event_type,
          al.created_at AS event_time,
          NULL AS consegna_data,
          t.display_name AS partecipante_nome,
          a.username AS user_name,
          NULL, NULL, NULL, NULL, NULL, NULL,
          al.details
        FROM activity_logs al
        LEFT JOIN users t ON al.target_user_id = t.id
        LEFT JOIN users a ON al.actor_user_id = a.id
      ) combined
      ORDER BY event_time DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    console.log(`[LOGS] ${timestamp} - Retrieved ${events.length} events (total: ${total})`);

    res.json({
      success: true,
      events,
      page,
      limit,
      total,
      totalPages
    });
  } catch (error) {
    console.error(`[LOGS] ${timestamp} - Error fetching activity log:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero dei log' });
  }
});

module.exports = router;
