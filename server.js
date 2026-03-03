import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('geoguard.db');
db.pragma('foreign_keys = ON');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('Owner', 'Viewer')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL NOT NULL,
    expiry TEXT NOT NULL,
    password TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    user_id INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    latitude REAL,
    longitude REAL,
    status TEXT CHECK(status IN ('granted', 'denied')) NOT NULL,
    reason TEXT,
    FOREIGN KEY(document_id) REFERENCES documents(id)
  );
`);

// Migration: Add filepath to documents if it doesn't exist
try {
  db.prepare('ALTER TABLE documents ADD COLUMN filepath TEXT').run();
} catch (err) {
  // Column already exists or table doesn't exist yet
}

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'geoguard-secret-key';

// Middleware for Auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Auth APIs ---

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, email, hashedPassword, role);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// --- Document APIs ---

app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'Owner') return res.status(403).json({ error: 'Only owners can upload' });

  // Verify user still exists in DB (to prevent FK errors if DB was reset)
  const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id);
  if (!userExists) {
    return res.status(401).json({ error: 'User session invalid. Please log in again.' });
  }

  const { filename, latitude, longitude, radius, expiry, password } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const docId = Math.random().toString(36).substring(2, 15);
  
  let hashedDocPassword = null;
  if (password) {
    hashedDocPassword = await bcrypt.hash(password, 10);
  }

  try {
    db.prepare(`
      INSERT INTO documents (id, owner_id, filename, filepath, latitude, longitude, radius, expiry, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, req.user.id, filename || file.originalname, file.path, latitude, longitude, radius, expiry, hashedDocPassword);

    // Use APP_URL from env, or fallback to request host
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const accessUrl = `${appUrl}/access/${docId}`;
    const qrCode = await qrcode.toDataURL(accessUrl);

    res.status(201).json({ docId, qrCode, accessUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save document metadata' });
  }
});

// Haversine Formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

app.post('/api/documents/access/:id', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, password, userId } = req.body;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  let status = 'granted';
  let reason = '';

  // 1. Expiry Check
  if (new Date(doc.expiry) < new Date()) {
    status = 'denied';
    reason = 'Document expired';
  }

  // 2. Geo-fencing Check
  if (status === 'granted') {
    const distance = getDistance(doc.latitude, doc.longitude, latitude, longitude);
    if (distance > doc.radius) {
      status = 'denied';
      reason = 'Outside allowed area';
    }
  }

  // 3. Password Check
  if (status === 'granted' && doc.password) {
    if (!password || !(await bcrypt.compare(password, doc.password))) {
      status = 'denied';
      reason = 'Invalid password';
    }
  }

  // Log Attempt
  db.prepare(`
    INSERT INTO access_logs (document_id, user_id, latitude, longitude, status, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId || null, latitude, longitude, status, reason);

  if (status === 'denied') {
    return res.status(403).json({ status, reason });
  }

  res.json({ status, message: 'Access granted', filename: doc.filename });
});

app.get('/api/documents/download/:id', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, password } = req.query;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Re-verify access for download
  let status = 'granted';
  
  if (new Date(doc.expiry) < new Date()) status = 'denied';
  
  if (status === 'granted') {
    const distance = getDistance(doc.latitude, doc.longitude, parseFloat(latitude), parseFloat(longitude));
    if (distance > doc.radius) status = 'denied';
  }

  if (status === 'granted' && doc.password) {
    if (!password || !(await bcrypt.compare(password, doc.password))) status = 'denied';
  }

  if (status === 'denied') {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!doc.filepath || !fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'File not found on server' });
  }

  res.download(doc.filepath, doc.filename);
});

// --- Dashboard APIs ---

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isOwner = req.user.role === 'Owner';

  let totalDocs, totalAttempts, granted, denied;

  if (isOwner) {
    totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE owner_id = ?').get(userId);
    totalAttempts = db.prepare(`
      SELECT COUNT(*) as count FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE documents.owner_id = ?
    `).get(userId);
    granted = db.prepare(`
      SELECT COUNT(*) as count FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE documents.owner_id = ? AND status = 'granted'
    `).get(userId);
    denied = db.prepare(`
      SELECT COUNT(*) as count FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE documents.owner_id = ? AND status = 'denied'
    `).get(userId);
  } else {
    totalDocs = { count: 0 };
    totalAttempts = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE user_id = ?').get(userId);
    granted = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE user_id = ? AND status = "granted"').get(userId);
    denied = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE user_id = ? AND status = "denied"').get(userId);
  }

  res.json({
    totalDocuments: totalDocs.count,
    totalAttempts: totalAttempts.count,
    granted: granted.count,
    denied: denied.count
  });
});

app.get('/api/dashboard/logs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isOwner = req.user.role === 'Owner';

  let logs;
  if (isOwner) {
    logs = db.prepare(`
      SELECT access_logs.*, documents.filename 
      FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE documents.owner_id = ?
      ORDER BY timestamp DESC
    `).all(userId);
  } else {
    logs = db.prepare(`
      SELECT access_logs.*, documents.filename 
      FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE access_logs.user_id = ?
      ORDER BY timestamp DESC
    `).all(userId);
  }

  res.json(logs);
});

app.get('/api/dashboard/usage', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isOwner = req.user.role === 'Owner';

  let usage;
  if (isOwner) {
    usage = db.prepare(`
      SELECT date(timestamp) as date, COUNT(*) as count 
      FROM access_logs 
      JOIN documents ON access_logs.document_id = documents.id 
      WHERE documents.owner_id = ?
      GROUP BY date(timestamp)
      ORDER BY date ASC
      LIMIT 7
    `).all(userId);
  } else {
    usage = db.prepare(`
      SELECT date(timestamp) as date, COUNT(*) as count 
      FROM access_logs 
      WHERE user_id = ?
      GROUP BY date(timestamp)
      ORDER BY date ASC
      LIMIT 7
    `).all(userId);
  }

  res.json(usage);
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
