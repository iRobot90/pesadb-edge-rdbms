
import * as fs from 'fs';
import * as path from 'path';
import { Table, Column, Row } from './Table';

export class Database {
    tables: Map<string, Table>;
    dataDir: string;

    constructor(dataDir: string = './data') {
        this.tables = new Map();
        this.dataDir = dataDir;
        // ensure data dir exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    createTable(name: string, columns: Column[]) {
        if (this.tables.has(name)) {
            throw new Error(`Table '${name}' already exists.`);
        }
        const table = new Table(name, columns);
        this.tables.set(name, table);
        this.save(); // Auto-save schema
        return table;
    }

    getTable(name: string): Table {
        const table = this.tables.get(name);
        if (!table) {
            throw new Error(`Table '${name}' not found.`);
        }
        return table;
    }

    dropTable(name: string) {
        if (!this.tables.has(name)) {
            throw new Error(`Table '${name}' not found.`);
        }
        this.tables.delete(name);
        this.save();
    }

    // Basic Persistence: Save entire DB to JSON
    save() {
        const backup: any = {
            tables: []
        };
        for (const [name, table] of this.tables) {
            backup.tables.push({
                name: table.name,
                columns: table.columns,
                rows: table.rows
            });
        }
        fs.writeFileSync(path.join(this.dataDir, 'pesadb.json'), JSON.stringify(backup, null, 2));
    }

    load() {
        const dbPath = path.join(this.dataDir, 'pesadb.json');
        if (!fs.existsSync(dbPath)) return;

        try {
            const data = fs.readFileSync(dbPath, 'utf8');
            const backup = JSON.parse(data);

            this.tables.clear();
            for (const tData of backup.tables) {
                const table = new Table(tData.name, tData.columns);
                // Bulk insert rows (skipping heavy strict checks for speed during load, but maintaining indices)
                // Ideally we use table.insert() but that might be slow for massive data.
                // For this challenge, table.insert is fine to ensure integrity.
                for (const row of tData.rows) {
                    table.insert(row);
                }
                this.tables.set(table.name, table);
            }
            console.log(`Database loaded from ${dbPath}`);
        } catch (e) {
            console.error("Failed to load database:", e);
        }
    }
}
