import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { body, validationResult, param, query } from 'express-validator';
import { Database } from '../core/Database';
import morgan from 'morgan';
import { apiKeyStore } from './apiKeyStore';

// Load environment
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Security middleware
app.use(helmet());

// CORS - restrict in production via CORS_ORIGIN env
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: corsOrigin }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX || 100), // limit each IP to X requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Database Init
const db = new Database();
db.load();

// Ensure transactions table exists (idempotent)
try {
    // If table already exists the Database.createTable will throw. We ignore that.
    db.createTable('transactions', [
        { name: 'id', type: 'string', isPrimaryKey: true },
        { name: 'amount', type: 'number' },
        { name: 'merchant', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'timestamp', type: 'string' }
    ]);
    console.log("Initialized 'transactions' table.");
} catch (e: any) {
    // Ignore "already exists" style errors coming from createTable
}

// Use ApiKeyStore for persistent key management
// Auth middleware validates tokens via the store and attaches role to request
function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
    const header = (req.headers['x-api-key'] as string) || '';
    let token = header;
    // support Bearer <token>
    if (!token && req.headers.authorization) {
        const auth = req.headers.authorization as string;
        if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
    }

    if (!token) {
        return res.status(401).json({ error: 'Missing API key' });
    }

    const role = apiKeyStore.validate(token);
    if (!role) return res.status(403).json({ error: 'Invalid API key' });

    // Attach user info to request
    (req as any).user = { apiKey: token, role };
    next();
}

function requireRole(minRole: 'user' | 'admin') {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Unauthenticated' });
        if (minRole === 'admin' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// Helper to format validation errors
function handleValidation(req: Request, res: Response): boolean {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return false;
    }
    return true;
}

// Routes
app.get('/api/transactions', authenticateApiKey, [
    query('status').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
], (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
        const table = db.getTable('transactions');
        let rows = table.select({});

        const status = req.query.status as string | undefined;
        const from = req.query.from as string | undefined;
        const to = req.query.to as string | undefined;

        if (status) rows = rows.filter(r => r.status === status);
        if (from) rows = rows.filter(r => r.timestamp >= from);
        if (to) rows = rows.filter(r => r.timestamp <= to);

        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin API: manage API keys (create, list, revoke)
// These endpoints require an admin API key
app.post('/admin/api-keys', authenticateApiKey, requireRole('admin'), [
    body('role').isIn(['admin', 'user'])
], (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const { role } = req.body as { role: 'admin' | 'user' };
    try {
        const created = apiKeyStore.create(role);
        // Return the token once (only place it is visible)
        res.status(201).json({ id: created.id, token: created.token, role: created.role });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/admin/api-keys', authenticateApiKey, requireRole('admin'), (req: Request, res: Response) => {
    try {
        res.json({ keys: apiKeyStore.list() });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/admin/api-keys/:id', authenticateApiKey, requireRole('admin'), [param('id').isString().notEmpty()], (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const ok = apiKeyStore.revoke(id);
        if (!ok) return res.status(404).json({ error: 'Key not found' });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/transactions', authenticateApiKey, [
    body('id').isString().notEmpty(),
    body('amount').isNumeric(),
    body('merchant').isString().notEmpty(),
    body('status').isIn(['Success', 'Pending', 'Failed']),
    body('timestamp').isISO8601(),
], (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
        const { id, amount, merchant, status, timestamp } = req.body;
        const table = db.getTable('transactions');
        const row = { id, amount: Number(amount), merchant, status, timestamp } as any;
        table.insert(row);
        db.save();
        res.status(201).json({ success: true, id });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/transactions/:id', authenticateApiKey, requireRole('admin'), [
    param('id').isString().notEmpty()
], (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
        const { id } = req.params;
        const table = db.getTable('transactions');
        const deleted = table.delete({ id });
        db.save();
        res.json({ success: true, deleted });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Generic error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`PesaTrack Server running at http://localhost:${PORT}`);
    // If the apiKeyStore is empty, warn
    if (apiKeyStore.list().length === 0) {
        console.warn('No API keys configured. Use the /admin/api-keys endpoint to create keys or populate data/api_keys.json.');
    }
});

export default app; // place after app setup, before or instead of app.listen for test runs
