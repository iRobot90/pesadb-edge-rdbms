
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import { Database } from '../core/Database';
import { SQLParser } from '../core/Parser';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Database Init
const db = new Database();
db.load();
const parser = new SQLParser(db);

// Ensure Tables Exist
try {
    parser.execute(`CREATE TABLE transactions (
        id string pk, 
        amount number, 
        merchant string, 
        status string, 
        timestamp string
    )`);
    console.log("Initialized 'transactions' table.");
} catch (e: any) {
    if (!e.message.includes('already exists')) {
        console.error("DB Init Error:", e);
    }
}

// Routes
app.get('/api/transactions', (req, res) => {
    try {
        const result = parser.execute("SELECT * FROM transactions");
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/transactions', (req, res) => {
    try {
        const { id, amount, merchant, status, timestamp } = req.body;
        // Naive string formatting for query - in production use bind params, but our simplified parser doesn't support them yet
        // So we manually construct the query very carefully.
        const query = `INSERT INTO transactions 
                       (id, amount, merchant, status, timestamp) 
                       VALUES 
                       ("${id}", ${amount}, "${merchant}", "${status}", "${timestamp}")`;

        parser.execute(query);
        res.json({ success: true, id });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/transactions/:id', (req, res) => {
    try {
        const { id } = req.params;
        parser.execute(`DELETE FROM transactions WHERE id="${id}"`);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`PesaTrack Server running at http://localhost:${PORT}`);
});
