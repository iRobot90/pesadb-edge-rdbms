
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
        // Check if this is a JOIN query (INNER, LEFT, or RIGHT)
        if (cmd.match(/\s+(INNER|LEFT|RIGHT)\s+JOIN/i)) {
            return this.handleJoin(cmd);
        }

        // SELECT * FROM table WHERE col=val
        // SELECT * FROM table WHERE amount > 1000
        // SELECT * FROM table WHERE date BETWEEN 2024-01-01 AND 2024-12-31
        const match = cmd.match(/^SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?$/i);
        if (!match) throw new Error("Syntax error in SELECT");

        const selectCols = match[1] === '*' ? null : match[1].split(',').map(s => s.trim());
        const tableName = match[2];
        const whereClause = match[3];

        const table = this.db.getTable(tableName);
        let rows: Row[];

        if (whereClause) {
            // Parse WHERE clause to check for range operators
            rows = this.executeWhereClause(table, whereClause);
        } else {
            rows = table.select({});
        }

        if (!selectCols) return rows;

        return rows.map(r => {
            const projected: Row = {};
            selectCols.forEach(c => projected[c] = r[c]);
            return projected;
        });
    }

    // Execute WHERE clause with support for range operators
    private executeWhereClause(table: any, clause: string): Row[] {
        // Check for BETWEEN operator
        const betweenMatch = clause.match(/(\w+)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)/i);
        if (betweenMatch) {
            const column = betweenMatch[1];
            const minValue = this.parseValue(betweenMatch[2].trim());
            const maxValue = this.parseValue(betweenMatch[3].trim());
            return table.selectBetween(column, minValue, maxValue);
        }

        // Check for >= operator
        if (clause.includes('>=')) {
            const parts = clause.split('>=');
            if (parts.length === 2) {
                const column = parts[0].trim();
                const value = this.parseValue(parts[1].trim());
                return table.selectGreaterThanOrEqual(column, value);
            }
        }

        // Check for <= operator
        if (clause.includes('<=')) {
            const parts = clause.split('<=');
            if (parts.length === 2) {
                const column = parts[0].trim();
                const value = this.parseValue(parts[1].trim());
                return table.selectLessThanOrEqual(column, value);
            }
        }

        // Check for > operator (must check after >=)
        if (clause.includes('>') && !clause.includes('>=')) {
            const parts = clause.split('>');
            if (parts.length === 2) {
                const column = parts[0].trim();
                const value = this.parseValue(parts[1].trim());
                return table.selectGreaterThan(column, value);
            }
        }

        // Check for < operator (must check after <=)
        if (clause.includes('<') && !clause.includes('<=')) {
            const parts = clause.split('<');
            if (parts.length === 2) {
                const column = parts[0].trim();
                const value = this.parseValue(parts[1].trim());
                return table.selectLessThan(column, value);
            }
        }

        // Fall back to equality check
        const where = this.parseWhere(clause);
        return table.select(where);
    }

    // Enhanced JOIN implementation supporting INNER, LEFT, and RIGHT JOINs
    // SELECT * FROM table1 INNER JOIN table2 ON table1.col = table2.col
    // SELECT * FROM table1 LEFT JOIN table2 ON table1.col = table2.col WHERE condition
    // SELECT t1.col1, t2.col2 FROM table1 t1 RIGHT JOIN table2 t2 ON t1.id = t2.id
    private handleJoin(cmd: string) {
        // Enhanced JOIN parser with WHERE clause support
        // Format: SELECT cols FROM table1 [INNER|LEFT|RIGHT] JOIN table2 ON table1.key = table2.key [WHERE condition]
        const joinMatch = cmd.match(
            /^SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+(\w+))?\s+(INNER|LEFT|RIGHT)\s+JOIN\s+(\w+)(?:\s+(\w+))?\s+ON\s+([\w.]+)\s*=\s*([\w.]+)(?:\s+WHERE\s+(.*))?$/i
        );

        if (!joinMatch) {
            throw new Error("Syntax error in JOIN. Use: SELECT * FROM table1 [INNER|LEFT|RIGHT] JOIN table2 ON table1.col = table2.col [WHERE condition]");
        }

        const selectCols = joinMatch[1];
        const table1Name = joinMatch[2];
        const table1Alias = joinMatch[3] || table1Name;
        const joinType = joinMatch[4].toUpperCase() as 'INNER' | 'LEFT' | 'RIGHT';
        const table2Name = joinMatch[5];
        const table2Alias = joinMatch[6] || table2Name;
        const joinKey1 = joinMatch[7];
        const joinKey2 = joinMatch[8];
        const whereClause = joinMatch[9];

        // Parse join keys (handle table.column format)
        const parseJoinKey = (key: string, defaultTable: string) => {
            const parts = key.split('.');
            return parts.length === 2 ? { table: parts[0], column: parts[1] } : { table: defaultTable, column: key };
        };

        const key1 = parseJoinKey(joinKey1, table1Alias);
        const key2 = parseJoinKey(joinKey2, table2Alias);

        // Get tables
        const table1 = this.db.getTable(table1Name);
        const table2 = this.db.getTable(table2Name);

        const rows1 = table1.select({});
        const rows2 = table2.select({});

        // Perform JOIN using Hash Join algorithm (O(N+M) instead of O(N*M))
        const joinedRows: Row[] = [];

        // Build hash map for the smaller table (optimization)
        const [smallerRows, largerRows, isTable1Smaller] = rows1.length <= rows2.length
            ? [rows1, rows2, true]
            : [rows2, rows1, false];

        // Determine which key to use for hashing based on which table is smaller
        const hashKey = isTable1Smaller ? key1.column : key2.column;
        const lookupKey = isTable1Smaller ? key2.column : key1.column;

        // Build hash map
        const hashMap = new Map<any, Row[]>();
        for (const row of smallerRows) {
            const keyValue = row[hashKey];
            if (keyValue !== undefined && keyValue !== null) {
                if (!hashMap.has(keyValue)) {
                    hashMap.set(keyValue, []);
                }
                hashMap.get(keyValue)!.push(row);
            }
        }

        // Perform the join based on join type
        if (joinType === 'INNER') {
            // INNER JOIN: Only matching rows
            for (const largerRow of largerRows) {
                const keyValue = largerRow[lookupKey];
                if (hashMap.has(keyValue)) {
                    const matchingRows = hashMap.get(keyValue)!;
                    for (const smallerRow of matchingRows) {
                        const [row1, row2] = isTable1Smaller ? [smallerRow, largerRow] : [largerRow, smallerRow];
                        joinedRows.push(this.createJoinedRow(row1, row2, table1Alias, table2Alias));
                    }
                }
            }
        } else if (joinType === 'LEFT') {
            // LEFT JOIN: All rows from left table, matched rows from right, nulls where no match
            for (const row1 of rows1) {
                const keyValue = row1[key1.column];
                let matched = false;

                if (hashMap.has(keyValue) && !isTable1Smaller) {
                    const matchingRows = hashMap.get(keyValue)!;
                    for (const row2 of matchingRows) {
                        joinedRows.push(this.createJoinedRow(row1, row2, table1Alias, table2Alias));
                        matched = true;
                    }
                } else if (isTable1Smaller) {
                    // Need to search in rows2
                    for (const row2 of rows2) {
                        if (row1[key1.column] === row2[key2.column]) {
                            joinedRows.push(this.createJoinedRow(row1, row2, table1Alias, table2Alias));
                            matched = true;
                        }
                    }
                }

                if (!matched) {
                    // Create row with nulls for table2 columns
                    joinedRows.push(this.createJoinedRow(row1, null, table1Alias, table2Alias));
                }
            }
        } else if (joinType === 'RIGHT') {
            // RIGHT JOIN: All rows from right table, matched rows from left, nulls where no match
            for (const row2 of rows2) {
                const keyValue = row2[key2.column];
                let matched = false;

                if (hashMap.has(keyValue) && isTable1Smaller) {
                    const matchingRows = hashMap.get(keyValue)!;
                    for (const row1 of matchingRows) {
                        joinedRows.push(this.createJoinedRow(row1, row2, table1Alias, table2Alias));
                        matched = true;
                    }
                } else if (!isTable1Smaller) {
                    // Need to search in rows1
                    for (const row1 of rows1) {
                        if (row1[key1.column] === row2[key2.column]) {
                            joinedRows.push(this.createJoinedRow(row1, row2, table1Alias, table2Alias));
                            matched = true;
                        }
                    }
                }

                if (!matched) {
                    // Create row with nulls for table1 columns
                    joinedRows.push(this.createJoinedRow(null, row2, table1Alias, table2Alias));
                }
            }
        }

        // Apply WHERE clause if present
        let filteredRows = joinedRows;
        if (whereClause) {
            filteredRows = this.filterJoinedRows(joinedRows, whereClause, table1Alias, table2Alias);
        }

        // Handle column projection
        if (selectCols === '*') {
            return filteredRows;
        }

        // Parse selected columns
        const selectedCols = selectCols.split(',').map(s => s.trim());
        return filteredRows.map(row => {
            const projected: Row = {};
            selectedCols.forEach(col => {
                // Handle table.column format or just column
                if (col.includes('.')) {
                    projected[col] = row[col];
                } else {
                    // Search in both tables
                    const table1Key = `${table1Alias}.${col}`;
                    const table2Key = `${table2Alias}.${col}`;
                    if (row[table1Key] !== undefined) {
                        projected[col] = row[table1Key];
                    } else if (row[table2Key] !== undefined) {
                        projected[col] = row[table2Key];
                    }
                }
            });
            return projected;
        });
    }

    // Helper function to create a joined row with proper aliasing
    private createJoinedRow(row1: Row | null, row2: Row | null, table1Alias: string, table2Alias: string): Row {
        const joinedRow: Row = {};

        // Add columns from table1 with prefix
        if (row1) {
            for (const col in row1) {
                joinedRow[`${table1Alias}.${col}`] = row1[col];
            }
        } else {
            // Add null columns for table1
            joinedRow[`${table1Alias}.*`] = null;
        }

        // Add columns from table2 with prefix
        if (row2) {
            for (const col in row2) {
                joinedRow[`${table2Alias}.${col}`] = row2[col];
            }
        } else {
            // Add null columns for table2
            joinedRow[`${table2Alias}.*`] = null;
        }

        return joinedRow;
    }

    // Helper function to filter joined rows based on WHERE clause
    private filterJoinedRows(rows: Row[], whereClause: string, table1Alias: string, table2Alias: string): Row[] {
        // Parse WHERE clause with support for prefixed columns
        // Example: WHERE orders.amount > 1000 AND customers.name = "Alice"

        // For simplicity, support single condition for now
        // Format: table.col = val or col = val
        const parts = whereClause.split('=');
        if (parts.length !== 2) {
            throw new Error(`Simple WHERE clause supported (col = val or table.col = val). Got: ${whereClause}`);
        }

        const keyPart = parts[0].trim();
        const val = this.parseValue(parts[1].trim());

        return rows.filter(row => {
            // Handle both "column" and "table.column" formats
            if (keyPart.includes('.')) {
                return row[keyPart] === val;
            } else {
                // Check both table aliases
                const table1Key = `${table1Alias}.${keyPart}`;
                const table2Key = `${table2Alias}.${keyPart}`;
                return row[table1Key] === val || row[table2Key] === val;
            }
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
