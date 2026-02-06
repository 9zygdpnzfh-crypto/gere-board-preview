console.log("ENV:", process.env.NODE_ENV);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const WebSocket = require('ws');
const pool = require('./db');
const { parse } = require('json2csv');
const helmet = require('helmet')

/* ======================
   ENV
====================== */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}

/* ======================
   APP
====================== */
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
'Strict-Transport-Security',
'max-age=31536000; includeSubDomains; preload');
next();
});
app.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 300 }));
app.use(express.static('public'));
app.use('/admin', requireAuth, );
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});
app.use(helmet())
app.use((req, res, next) => {
  if (req.user && !req.user.city_id) {
    return res.status(403).json({ error: 'City context missing' })
  }
  next()
})
/* ======================
   WEBSOCKET (READ ONLY)
====================== */
const wss = new WebSocket.Server({ port: 8080 });

function broadcast(payload) {
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify(payload));
    }
  });
}
console.log('WebSocket running on ws://localhost:8080');
const sendQuotaUpdateNotification = (quotaData) => {
  const message = {
    type: 'quota-update',
    data: quotaData,
  };

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
       client.send(JSON.stringify(message));
    }
  });
};

wss.on('connection', ws => {
  console.log('Client connected');

  // Send initial connection message
  ws.send(JSON.stringify({ message: 'Welcome to WebSocket!' }));

  ws.on('message', (message) => {
    console.log('Received:', message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Example of broadcasting data to all connected clients
function broadcastUpdate(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
wss.on('connection', ws => {
  ws.on('message', (message) => {
    // Handle incoming messages if necessary
  });
  
let available = true;
 // Example: Send a message to all clients when new quota data is available
  const sendLiveUpdate = (data) => {
    wss.clients.forEach(client => {
      if (ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify(data));
      }
    });
  };

  // Simulate sending live updates
  setInterval(() => {
    sendLiveUpdate({ type: 'quota-update', data: { totalQuota: 100, 
usedQuota: 50 } });
  }, 5000); // every 5 seconds
});
/* ======================
   AUTH
====================== */

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const helmet = require('helmet')
  if (!header) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  const r = await pool.query(
    `
    SELECT r.name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1
    `,
    [req.user.id]
  );

  const roles = r.rows.map(row => row.name);

  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user.roles = roles;
  next();
}
async function logUserEvent(userId, event_type, metadata = {}) {
  await pool.query(
    `INSERT INTO user_events (user_id, event_type, metadata)
     VALUES ($1, $2, $3)`,
    [userId, event_type, metadata]
  );
}
function requireSectorAccess(sectorIdParam, action = 'view') {
  return async (req, res, next) => {
    const sectorId = req.params[sectorIdParam];

    const r = await pool.query(
      `
      SELECT sp.can_view, sp.can_edit
      FROM sector_permissions sp
      JOIN user_roles ur ON sp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND sp.sector_id = $2
      `,
      [req.user.id, sectorId]
    );

    if (!r.rowCount) {
      return res.status(403).json({ error: 'No sector access' });
    }

    const allowed =
      action === 'edit'
        ? r.rows.some(row => row.can_edit)
        : r.rows.some(row => row.can_view);

    if (!allowed) {
      return res
        .status(403)
        .json({ error: 'Insufficient sector permission' }); // FIXED 
STRING
    }

    next();
  };
}

function enforceStatusTransition(allowed) {
  return (req, res, next) => {
    const { status } = req.body;

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    next();
  };
}
const STATE_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active']
};

function enforceStateMachine(entity, table) {
  return async (req, res, next) => {
    const { status } = req.body;

    const r = await pool.query(
      `SELECT status FROM ${table} WHERE id = $1`,
      [req.params.id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: `${entity} not found` });
    }

    const current = r.rows[0].status;
    const allowed = STATE_TRANSITIONS[current] || [];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid transition: ${current} → ${status}`
      });
    }

    next();
  };
}
function requireSameMunicipality(table) {
  return async (req, res, next) => {
    const r = await pool.query(
      `SELECT municipality_id FROM ${table} WHERE id = $1`,
      [req.params.id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (r.rows[0].municipality_id !== req.user.municipality_id) {
      return res.status(403).json({ error: 'Cross-city access denied' });
    }

    next();
  };
}
/* ======================
   CORE
====================== */
app.get('/', (_, res) => res.send('AA911 backend running'));

app.get('/db-test', async (_, res) => {
  const r = await pool.query('SELECT NOW()');
  res.json({ success: true, time: r.rows[0] });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})
/* ======================
   USERS
====================== */
app.post(
  '/users',
  [
    body('full_name').isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 8 })
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const { full_name, email, password } = req.body;
const { body } = req;
const validInput = /^[a-zA-Z0-9\s]*$/; 
if (!validInput.test(body.input)) {
  return res.status(400).json({ error: 'Invalid input' });
}
    const hash = await bcrypt.hash(password, 10);

    const r = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, full_name, email`,
      [full_name, email, hash]
    );
  await logEvent(r.rows[0].id, 'user_created');
    res.json({ success: true, user: r.rows[0] });
  }
);
app.get('/users', (req, res) => {
  res.json({
    message: 'Users endpoint is alive',
    users: []
  });
});
app.get('/users/:id/timeline', requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT event_type, metadata, created_at
    FROM user_events
    WHERE user_id = $1
    ORDER BY created_at ASC
    `,
    [req.params.id]
  );

  res.json({ success: true, timeline: r.rows });
});
app.get('/users/:id/events', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, event_type, created_at
       FROM user_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 25`,
      [req.params.id]
    );

    res.json({ success: true, events: r.rows });
} catch (err) {
  console.error('EVENT FETCH ERROR:', err); // Log the full error
  res.status(500).json({
    success: false,
    error: err.message // Return the actual error messasge for debugging
  });
 }
});
app.get('/users/:id/roles', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.id, r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, roles: r.rows });
  } catch (err) {
    console.error('USER ROLES ERROR:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user roles'
    });
  }
});
/* ======================
   LOGIN
====================== */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const r = await pool.query(
    'SELECT * FROM users WHERE email=$1',
    [email]
  );
  if (!r.rowCount) return res.status(401).json({ error: 'Invalid login' 
});

  const ok = await bcrypt.compare(password, r.rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid login' });

  const token = jwt.sign({ id: r.rows[0].id }, JWT_SECRET, {
    expiresIn: '1h'
  });
await logEvent(r.rows[0].id, 'login_success');
await logUserEvent(user.id, 'login');
await logUserEvent(req.user.id, 'beneficiary_enrolled');
await logUserEvent(req.user.id, 'beneficiary_approved');
  res.json({ token 
});
});

/* ======================
   ROLES
====================== */
app.get('/roles', async (_, res) => {
  const r = await pool.query(
    'SELECT id, name, description FROM roles ORDER BY id'
  );
  res.json({ success: true, roles: r.rows });
});
/* ======================
   SECTORS
====================== */
// List sectors
app.get('/sectors', async (_, res) => {
  const r = await pool.query('SELECT * FROM sectors ORDER BY id');
  res.json({ success: true, sectors: r.rows });
});

// Sector flows (protected)
app.get(
  '/sectors/:sector_id',
  requireAuth,
  requireSectorAccess('sector_id', 'view'),
  async (req, res) => {
    const { sector_id } = req.params;

    const r = await pool.query(
      'SELECT * FROM sectors WHERE id = $1',
      [sector_id]
    );

    res.json({ success: true, sector: r.rows[0] });
  }
);
app.get('/partner/dashboard', requireAuth, async (req, res) => {
  const orgs = await pool.query(
    `
    SELECT o.id, o.name, s.name AS sector, q.used, q.limit
    FROM organizations o
    JOIN sectors s ON o.sector_id = s.id
    LEFT JOIN quota_usage q ON o.id = q.organization_id
    WHERE o.owner_user_id = $1
    `,
    [req.user.id]
  );

  res.json({ success: true, organizations: orgs.rows });
});
app.get('/admin/dashboard/sector/:sectorId',
 requireAuth,
 async (req, res) => {
  const { sectorId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        COUNT(o.id) AS totalOrganizations,
        SUM(o.quota) AS total_quota
        FROM organizations o
       WHERE o.sector_id = $1`, 

      [sectorId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sector data' });
  }
});
app.get('/admin/dashboard/sector/:sectorId',
 requireAuth, async (req, res) => {
  const { sectorId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        COUNT(o.id) AS totalOrganizations,
        SUM(o.quota) AS totalQuota
       FROM organizations o
       WHERE o.sector_id = $1`, 
      [sectorId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sector data' });
  }
});
app.get('/admin/sector/:sectorId/partners', requireAuth,
 async (req, res) => {
  const { sectorId } = req.params;

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

const requirePartner = (req, res, next) => {
  if (req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};
  try {
    const result = await pool.query(
      `SELECT 
         p.id AS partnerId, 
         p.name AS partnerName,
         COUNT(o.id) AS totalOrganizations,
         SUM(o.quota) AS totalQuota
       FROM partners p
       LEFT JOIN organizations o ON p.id = o.partner_id
       WHERE o.sector_id = $1
       GROUP BY p.id`, 
      [sectorId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching partners data' });
  }
});
app.get('/sectors', requireAuth, async (req, res) => {
  const cityId = req.user.city_id;
  const r = await pool.query(
    'SELECT * FROM sectors WHERE city_id=$1 ORDER BY id',
    [cityId]
  );
  res.json({ success: true, sectors: r.rows });
});
/* ======================
   ORGANIZATIONS
====================== */
app.post('/organizations/register', requireAuth, async (req, res) => {
  const { name, sector_id, quota } = req.body;

  await pool.query(
    `INSERT INTO organizations (name, sector_id, quota)
     VALUES ($1,$2,$3)`,
    [name, sector_id, quota || 0]
  );

  res.json({ success: true, message: 'Pending approval' });
});
app.post("/admin/notifications", requireAuth, async (req, res) => {
  const { message } = req.body;

  try {
    broadcast({
      type: "notification",
      message
    });

    res.json({ status: "Notification sent" });
  } catch (error) {
    res.status(500).json({ error: "Error sending notification" });
  }
});
app.get(
  '/admin/organizations/pending',
  requireAuth,
  async (_, res) => {
    const r = await pool.query(
      `SELECT o.id, o.name, s.name AS sector
       FROM organizations o
       JOIN sectors s ON o.sector_id = s.id
       WHERE o.approved = false`
    );
    res.json({ success: true, pending: r.rows });
  }
);
app.get('/organizations/:id/timeline', requireAuth, async (req, res) => {
  const log = await pool.query(
    `
    SELECT event_type, created_at
    FROM organization_flow_log
    WHERE organization_id = $1
    ORDER BY created_at ASC
    `,
    [req.params.id]
  );

  res.json({ success: true, timeline: log.rows });
});
app.get(
  '/sectors/:sector_id/organizations',
  requireAuth,
  requireSectorAccess('sector_id', 'view'),
  async (req, res) => {
    const r = await pool.query(
      'SELECT * FROM organizations WHERE sector_id = $1',
      [req.params.sector_id]
    );
    res.json({ success: true, organizations: r.rows });
  }
);
app.get('/admin/quota-usage', requireAuth, 
 async (req, res) => {
  const r = await pool.query(`
    SELECT
      o.name AS organization,
      s.name AS sector,
      q.amount_used,
      q.created_at
    FROM quota_usage q
    JOIN organizations o ON q.organization_id = o.id
    JOIN sectors s ON o.sector_id = s.id
    ORDER BY q.created_at DESC
    LIMIT 100
  `);

  res.json({ success: true, usage: r.rows });
});
app.get('/admin/export-quotas', requireAuth, 
 async (req, res) => {
  const { startDate, endDate, sectorId } = req.query;  // Filters from URL 
params
  
  try {
    let query = 'SELECT * FROM quotas WHERE 1=1';
    const params = [];
    
    if (startDate) {
      query += ' AND created_at >= $1';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= $2';
      params.push(endDate);
    }

    if (sectorId) {
      query += ' AND sector_id = $3';
      params.push(sectorId);
    }

    const result = await pool.query(query, params);
    const csv = parse(result.rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('quota-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exporting quota data' });
  }
});
app.get('/admin/export-quotas', requireAuth, requireAdmin, async (req, 
res) => {
  try {
    const result = await pool.query('SELECT * FROM quotas');
    const csv = parse(result.rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('quota-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exporting quota data' });
  }
});
app.get('/admin/events', requireAuth,  async (req, res) => {
  const r = await pool.query(
    `
    SELECT ue.event_type, u.full_name, ue.created_at
    FROM user_events ue
    JOIN users u ON ue.user_id = u.id
    ORDER BY ue.created_at DESC
    LIMIT 50
    `
  );

  res.json({ success: true, events: r.rows });
});
app.get('/admin/export-events', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_events');
    const csv = parse(result.rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('events-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exporting events data' });
  }
});
app.get('/partner/dashboard', requireAuth, async (req, res) => {
  const r = await pool.query(`
    SELECT
      o.id,
      o.name,
      s.name AS sector,
      o.quota
    FROM organizations o
    JOIN sectors s ON o.sector_id = s.id
    JOIN user_roles ur ON ur.user_id = $1
    WHERE ur.role_id = (
      SELECT id FROM roles WHERE name = 'partner'
    )
    LIMIT 1
  `, [req.user.id]);

  res.json({ success: true, dashboard: r.rows[0] });
});
app.get('/admin/partner-dashboard/:sectorId', requireAuth, async (req, 
res) => {
  const { sectorId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
         COUNT(o.id) AS totalOrganizations,
         SUM(o.quota) AS totalQuota,
         COUNT(b.id) AS totalBeneficiaries
       FROM organizations o
       LEFT JOIN beneficiaries b ON o.id = b.organization_id
       WHERE o.sector_id = $1`, 
      [sectorId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching partner data' });
  }
});
app.get('/organizations', requireAuth, async (req, res) => {
  const cityId = req.user.city_id;
  const r = await pool.query(
    'SELECT * FROM organizations WHERE city_id=$1 ORDER BY id',
    [cityId]
  );
  res.json({ success: true, organizations: r.rows });
});
app.post(
  '/admin/organizations/:id/approve',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    await pool.query(
      'UPDATE organizations SET approved=true WHERE id=$1',
      [req.params.id]
    );

    broadcast({
      type: 'organization_approved',
      org_id: req.params.id,
      timestamp: Date.now()
    });

    res.json({ success: true });
  }
);

/* ======================
   BENEFICIARIES
====================== */
app.post('/beneficiaries/enroll', requireAuth, async (req, res) => {
  const { sector_id, organization_id } = req.body;

  await pool.query(
    `INSERT INTO beneficiaries (user_id, sector_id, organization_id)
     VALUES ($1,$2,$3)`,
    [req.user.id, sector_id, organization_id]
  );

  res.json({ success: true });
});
app.post(
  '/admin/beneficiaries/:id/status',
  requireAuth,
  enforceStateMachine('beneficiary', 'beneficiaries'),
  async (req, res) => {
    const { status } = req.body;

    await pool.query(
      'UPDATE beneficiaries SET status = $1 WHERE id = $2',
      [status, req.params.id]
    );

    await logUserEvent(req.user.id, `beneficiary_status_${status}`);

    res.json({ success: true });
  }
);
app.get('/beneficiaries', async (_, res) => {
  const r = await pool.query(
    `SELECT b.id, u.full_name, s.name AS sector, b.status
     FROM beneficiaries b
     JOIN users u ON b.user_id = u.id
     JOIN sectors s ON b.sector_id = s.id`
  );
  res.json({ success: true, beneficiaries: r.rows });
});
app.get(
  '/beneficiaries/:id',
  requireAuth,
  requireSameMunicipality('beneficiaries'),
  async (req, res) => {
    const r = await pool.query(
      'SELECT * FROM beneficiaries WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true, beneficiary: r.rows[0] });
  }
);
app.get('/beneficiaries', requireAuth, async (req, res) => {
  const cityId = req.user.city_id;
  const r = await pool.query(
    `SELECT b.id, u.full_name, s.name AS sector, b.status
     FROM beneficiaries b
     JOIN users u ON b.user_id = u.id
     JOIN sectors s ON b.sector_id = s.id
     WHERE u.city_id=$1`,
    [cityId]
  );
  res.json({ success: true, beneficiaries: r.rows });
});
app.post(
  '/admin/beneficiaries/:id/approve',
  requireAuth,
  async (req, res) => {
    await pool.query(
      'UPDATE beneficiaries SET status=$1 WHERE id=$2',
      ['approved', req.params.id]
    );
    res.json({ success: true });
  }
);
app.get('/admin/approvals', requireAuth, async (req, res) => 
{
  const orgs = await pool.query(
    `SELECT id, name, status FROM organizations WHERE status = 'pending'`
  );

  const beneficiaries = await pool.query(
    `SELECT id, user_id, status FROM beneficiaries WHERE status = 
'pending'`
  );

  res.json({
    success: true,
    organizations: orgs.rows,
    beneficiaries: beneficiaries.rows
  });
});
app.post('/admin/organizations/:id/approve', requireAuth, 
async (req, res) => {
  const { id } = req.params;

  await pool.query(
    `UPDATE organizations SET status='approved' WHERE id=$1`,
    [id]
  );

  await logUserEvent(req.user.id, 'ORG_APPROVED');

  res.json({ success: true });
});
app.get('/admin/quotas', requireAuth, async (req, res) => {
  const q = await pool.query(
    `
    SELECT q.id, q.limit_amount, qu.used_amount
    FROM quotas q
    LEFT JOIN quota_usage qu ON q.id = qu.quota_id
    `
  );

  res.json({ success: true, quotas: q.rows });
});
app.get('/admin/dashboard/sector/:sector_id', requireAuth, async (req, 
res) => {
  const { sector_id } = req.params;
  try {
    const sectorData = await pool.query(
      `SELECT
        COUNT(*) AS total_organizations,
        SUM(quota) AS total_quota
      FROM organizations
      WHERE sector_id = $1`,
      [sector_id]
    );

    const eventData = await pool.query(
      `SELECT event_type, COUNT(*) AS event_count
      FROM user_events
      JOIN beneficiaries ON user_events.user_id = beneficiaries.user_id
      WHERE beneficiaries.sector_id = $1
      GROUP BY event_type`,
      [sector_id]
    );

    res.json({
      sectorData: sectorData.rows[0],
      eventData: eventData.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching sector data' });
  }
});
app.get('/municipality/:id/export-events',
 requireAuth, async (req, res) => {
   const { id } = req.params;

  const r = await pool.query(
    `SELECT * FROM user_events WHERE municipality_id = $1`,
    [id]
  );

  const csv = parse(r.rows);
  res.header('Content-Type', 'text/csv');
  res.attachment('events.csv');
  res.send(csv);
});
app.get('/quotas', async (req, res, next) => {
  try {
    const pageSize = 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * pageSize;
    
    const result = await pool.query(
      'SELECT * FROM quotas LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});
/* ======================
   QUOTAS & FLOWS
====================== */
app.post('/quota/use', requireAuth, async (req, res) => {
  const { organization_id, beneficiary_id, amount } = req.body;

  const org = await pool.query(
    'SELECT quota FROM organizations WHERE id=$1 AND approved=true',
    [organization_id]
  );

  if (!org.rowCount || org.rows[0].quota < amount) {
    return res.status(400).json({ error: 'Insufficient quota' });
  }

  await pool.query(
    'UPDATE organizations SET quota = quota - $1 WHERE id=$2',
    [amount, organization_id]
  );

  await pool.query(
    `INSERT INTO quota_usage (organization_id, beneficiary_id, 
amount_used)
     VALUES ($1,$2,$3)`,
    [organization_id, beneficiary_id, amount]
  );

  broadcast({
    type: 'quota_used',
    organization_id,
    beneficiary_id,
    amount,
    timestamp: Date.now()
  });

  res.json({
    status: "confirmed",
    quota: amount
  });
}); // <-- CLOSE POST

app.get('/quotas', requireAuth, async (req, res) => {
  const cityId = req.user.city_id;
  const r = await pool.query(
    'SELECT * FROM quotas WHERE city_id=$1', 
    [cityId]
  );
  res.json({ success: true, quotas: r.rows });
});
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ error: 'System error' });
});

/* ======================
   SERVER
====================== */
app.listen(3000, () => {
  console.log('HTTP running on http://localhost:3000');
});
