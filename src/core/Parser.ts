
import { Database } from './Database';
import { Column, DataType, Row } from './Table';

export class SQLParser {
    db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    execute(command: string): any {
        // Normalize command: remove newlines, multiple spaces
        command = command.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

        if (command.match(/^CREATE TABLE/i)) {
            return this.handleCreateTable(command);
        } else if (command.match(/^INSERT INTO/i)) {
            return this.handleInsert(command);
        } else if (command.match(/^SELECT/i)) {
            return this.handleSelect(command);
        } else if (command.match(/^UPDATE/i)) {
            return this.handleUpdate(command);
        } else if (command.match(/^DELETE FROM/i)) {
            return this.handleDelete(command);
        } else {
            throw new Error(`Unknown command: ${command}`);
        }
    }

    // CREATE TABLE users (id number pk, name string, email string unique)
    private handleCreateTable(cmd: string) {
        // Regex is tricky for full SQL, doing simple split parsing
        const match = cmd.match(/^CREATE TABLE\s+(\w+)\s*\((.*)\)$/i);
        if (!match) throw new Error("Syntax error in CREATE TABLE");
        const tableName = match[1];
        const colsDef = match[2].split(',');

        const columns: Column[] = colsDef.map(c => {
            const parts = c.trim().split(/\s+/);
            const name = parts[0];
            const type = parts[1] as DataType;

            if (!['string', 'number', 'boolean'].includes(type)) {
                throw new Error(`Unsupported type '${type}'`);
            }

            const isPrimaryKey = parts.includes('pk') || parts.includes('primary');
            const isUnique = parts.includes('unique');

            return { name, type, isPrimaryKey, isUnique, isNullable: false };
        });

        this.db.createTable(tableName, columns);
        return `Table '${tableName}' created.`;
    }

    // INSERT INTO users (id, name) VALUES (1, "Alice")
    // Simplified: INSERT INTO users VALUES (1, "Alice") -- assumes strict order? 
    // Let's support standard key-value style
    private handleInsert(cmd: string) {
        // match: INSERT INTO table (c1, c2) VALUES (v1, v2)
        const match = cmd.match(/^INSERT INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)$/i);
        if (!match) throw new Error("Syntax error in INSERT. Use: INSERT INTO table (col1, col2) VALUES (val1, val2)");

        const tableName = match[1];
        const cols = match[2].split(',').map(s => s.trim());
        // naive value splitting (won't handle commas in strings well)
        const vals = match[3].split(',').map(s => this.parseValue(s.trim()));

        if (cols.length !== vals.length) throw new Error("Column/Value count mismatch");

        const row: Row = {};
        cols.forEach((col, i) => {
            row[col] = vals[i];
        });

        const table = this.db.getTable(tableName);
        table.insert(row);
        this.db.save(); // Auto-commit
        return `Inserted 1 row into '${tableName}'.`;
    }

    private handleSelect(cmd: string) {
        // SELECT * FROM table WHERE col=val
        // SELECT c1, c2 FROM table ...
        const match = cmd.match(/^SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?$/i);
        if (!match) throw new Error("Syntax error in SELECT");

        const selectCols = match[1] === '*' ? null : match[1].split(',').map(s => s.trim());
        const tableName = match[2];
        const whereClause = match[3];

        const table = this.db.getTable(tableName);
        let where: Partial<Row> = {};

        if (whereClause) {
            where = this.parseWhere(whereClause);
        }

        const rows = table.select(where);

        if (!selectCols) return rows;

        return rows.map(r => {
            const projected: Row = {};
            selectCols.forEach(c => projected[c] = r[c]);
            return projected;
        });
    }

    private handleUpdate(cmd: string) {
        // UPDATE table SET col=val, col2=val2 WHERE col=val
        const match = cmd.match(/^UPDATE\s+(\w+)\s+SET\s+(.*?)\s+WHERE\s+(.*)$/i);
        if (!match) throw new Error("Syntax error in UPDATE. WHERE clause is required for safety.");

        const tableName = match[1];
        const setClause = match[2];
        const whereClause = match[3];

        const table = this.db.getTable(tableName);
        const updates: Partial<Row> = {};

        setClause.split(',').forEach(part => {
            const [key, val] = part.split('=').map(s => s.trim());
            updates[key] = this.parseValue(val);
        });

        const where = this.parseWhere(whereClause);
        const count = table.update(where, updates);
        this.db.save();
        return `Updated ${count} rows.`;
    }

    private handleDelete(cmd: string) {
        // DELETE FROM table WHERE col=val
        const match = cmd.match(/^DELETE FROM\s+(\w+)\s+WHERE\s+(.*)$/i);
        if (!match) throw new Error("Syntax error in DELETE. WHERE clause is required.");

        const tableName = match[1];
        const whereClause = match[2];

        const table = this.db.getTable(tableName);
        const where = this.parseWhere(whereClause);
        const count = table.delete(where);
        this.db.save();
        return `Deleted ${count} rows.`;
    }

    private parseWhere(clause: string): Partial<Row> {
        // Simple single condition: col = val
        // TODO: Support AND/OR if time permits
        const parts = clause.split('=');
        if (parts.length !== 2) throw new Error(`Simple WHERE clause supported only (col = val). Got: ${clause}`);

        const key = parts[0].trim();
        const val = this.parseValue(parts[1].trim());
        return { [key]: val };
    }

    private parseValue(val: string): any {
        if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
        if (val === 'true') return true;
        if (val === 'false') return false;
        const num = Number(val);
        if (!isNaN(num)) return num;
        return val;
    }
}
