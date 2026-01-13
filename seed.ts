
import { Database } from './src/core/Database';
import { SQLParser } from './src/core/Parser';

const db = new Database();
db.load();
const parser = new SQLParser(db);

console.log("Seeding PesaDB...");

try {
    // Ensure table exists (idempotent-ish)
    try {
        parser.execute("CREATE TABLE transactions (id string pk, amount number, merchant string, status string, timestamp string)");
    } catch (e) { }

    const merchants = ["Kileleshwa Branch", "CBD Branch", "Westlands HQ", "Mombasa Road"];
    const statuses = ["Success", "Success", "Success", "Pending", "Failed"];

    for (let i = 0; i < 15; i++) {
        const id = 'TX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const amount = Math.floor(Math.random() * 5000) + 100;
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 10)); // Past 10 days
        const timestamp = date.toISOString().split('T')[0];

        const query = `INSERT INTO transactions 
                       (id, amount, merchant, status, timestamp) 
                       VALUES 
                       ("${id}", ${amount}, "${merchant}", "${status}", "${timestamp}")`;
        parser.execute(query);
    }
    console.log("Seeding complete. 15 records added.");

    // Seed Demo API Key
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');

    const keyFile = path.join(__dirname, 'data', 'api_keys.json');
    const demoToken = 'demo-key-123';
    const hashed = crypto.createHmac('sha256', 'pesadb_secret_salt').update(demoToken).digest('hex');

    const demoKey = {
        id: 'demo-id',
        hashed: hashed,
        role: 'admin',
        createdAt: new Date().toISOString()
    };

    fs.writeFileSync(keyFile, JSON.stringify({ keys: [demoKey] }, null, 2));
    console.log("Seeded demo API key: " + demoToken);

} catch (e) {
    console.error(e);
}
