
import { BTreeIndex } from './BTreeIndex';

export type DataType = 'string' | 'number' | 'boolean';

export interface Column {
    name: string;
    type: DataType;
    isPrimaryKey?: boolean;
    isUnique?: boolean;
    isNullable?: boolean;
}

export type Row = Record<string, any>;

export class Table {
    name: string;
    columns: Column[];
    rows: Row[]; // Using an array for storage (simple)
    indices: Map<string, Map<any, Row[]>>; // Hash indices: column_name -> (value -> rows[])
    btreeIndices: Map<string, BTreeIndex>; // B-Tree indices for range queries
    primaryKeyCol?: string;

    constructor(name: string, columns: Column[]) {
        this.name = name;
        this.columns = columns;
        this.rows = [];
        this.indices = new Map();
        this.btreeIndices = new Map();

        // Validate columns and setup indices/PK
        for (const col of columns) {
            if (col.isPrimaryKey) {
                if (this.primaryKeyCol) {
                    throw new Error(`Table ${name} can only have one primary key.`);
                }
                this.primaryKeyCol = col.name;
            }
            // Create hash index if PK or Unique
            if (col.isPrimaryKey || col.isUnique) {
                this.createIndex(col.name);
            }
            // Auto-create B-Tree index for numeric columns (for range queries)
            if (col.type === 'number') {
                this.createBTreeIndex(col.name);
            }
        }
    }

    createIndex(colName: string) {
        if (!this.indices.has(colName)) {
            this.indices.set(colName, new Map());
            // Rebuild index if rows exist
            for (const row of this.rows) {
                this.addToIndex(colName, row);
            }
        }
    }

    createBTreeIndex(colName: string) {
        if (!this.btreeIndices.has(colName)) {
            const btree = new BTreeIndex(colName);
            this.btreeIndices.set(colName, btree);
            // Rebuild index if rows exist
            for (const row of this.rows) {
                const value = row[colName];
                if (value !== null && value !== undefined) {
                    btree.insert(value, row);
                }
            }
        }
    }

    private addToIndex(colName: string, row: Row) {
        const index = this.indices.get(colName)!;
        const val = row[colName];
        if (val === undefined || val === null) return; // Don't index nulls for now unless we need to

        if (!index.has(val)) {
            index.set(val, []);
        }

        // Check uniqueness constraint
        const colDef = this.columns.find(c => c.name === colName);
        if ((colDef?.isUnique || colDef?.isPrimaryKey) && index.get(val)!.length > 0) {
            throw new Error(`Unique constraint violation on column '${colName}' with value '${val}'`);
        }

        index.get(val)!.push(row);
    }

    private removeFromIndex(colName: string, row: Row) {
        const index = this.indices.get(colName);
        if (!index) return;
        const val = row[colName];
        if (val === undefined || val === null) return;

        if (index.has(val)) {
            const rows = index.get(val)!;
            const rowIdx = rows.indexOf(row);
            if (rowIdx > -1) {
                rows.splice(rowIdx, 1);
            }
            if (rows.length === 0) {
                index.delete(val);
            }
        }
    }

    insert(row: Row) {
        // Validate types
        for (const col of this.columns) {
            if (row[col.name] !== undefined) {
                if (typeof row[col.name] !== col.type) {
                    // Basic type coercion or error? Let's error for strictness
                    throw new Error(`Invalid type for column '${col.name}'. Expected ${col.type}, got ${typeof row[col.name]}`);
                }
            } else if (!col.isNullable) {
                throw new Error(`Column '${col.name}' cannot be null`);
            }
        }

        // Check constraints via indices (simulated "dry run" or just insert and rollback on error?)
        // To be safe, we check before inserting into main storage
        for (const [colName] of this.indices) {
            const val = row[colName];
            const colDef = this.columns.find(c => c.name === colName);
            if (val !== undefined && val !== null && (colDef?.isUnique || colDef?.isPrimaryKey)) {
                const index = this.indices.get(colName)!;
                if (index.has(val)) {
                    throw new Error(`Unique constraint violation on column '${colName}' with value '${val}'`);
                }
            }
        }

        // Add to storage
        this.rows.push(row);

        // Update hash indices
        for (const [colName] of this.indices) {
            try {
                this.addToIndex(colName, row);
            } catch (e) {
                // Rollback (remove from already updated indices and main storage)
                // This is a simple implementation, partial rollback might be needed ideally
                this.rows.pop();
                // TODO: partial rollback of other indices if multiple
                throw e;
            }
        }

        // Update B-Tree indices
        for (const [colName, btree] of this.btreeIndices) {
            const value = row[colName];
            if (value !== null && value !== undefined) {
                btree.insert(value, row);
            }
        }
    }

    // Simple O(N) scan or O(1) lookup
    select(where?: Partial<Row>): Row[] {
        if (!where || Object.keys(where).length === 0) {
            return this.rows;
        }

        // Optimizer: Check if we are filtering by an indexed column
        // Priority: Primary Key -> Unique Key -> Any Index
        let candidateRows: Row[] | null = null;

        for (const key in where) {
            if (this.indices.has(key)) {
                const val = where[key];
                const indexOnCol = this.indices.get(key)!;
                if (indexOnCol.has(val)) {
                    const hits = indexOnCol.get(val)!;
                    if (candidateRows === null || hits.length < candidateRows.length) {
                        candidateRows = hits;
                    }
                } else {
                    return []; // Indexed lookup found nothing, so result is empty
                }
            }
        }

        // If we used an index, filter the candidates. If not, scan all rows.
        const searchSpace = candidateRows || this.rows;

        return searchSpace.filter(row => {
            for (const key in where) {
                if (row[key] !== where[key]) return false;
            }
            return true;
        });
    }

    update(where: Partial<Row>, updates: Partial<Row>) {
        const rowsToUpdate = this.select(where);
        const affected = rowsToUpdate.length;

        // Basic validation for updates
        // TODO: Check constraints before applying

        for (const row of rowsToUpdate) {
            // Remove from indices before mutating
            for (const [colName] of this.indices) {
                this.removeFromIndex(colName, row);
            }

            // Apply updates
            for (const key in updates) {
                row[key] = updates[key];
            }

            // Re-add to indices
            // Note: logic complexity here if constraints fail mid-update...
            // For this challenge, we assume happy path or simple errors
            for (const [colName] of this.indices) {
                this.addToIndex(colName, row);
            }
        }
        return affected;
    }

    delete(where: Partial<Row>) {
        const rowsToDelete = this.select(where);
        const affected = rowsToDelete.length;

        for (const row of rowsToDelete) {
            // Remove from hash indices
            for (const [colName] of this.indices) {
                this.removeFromIndex(colName, row);
            }

            // Remove from B-Tree indices
            for (const [colName, btree] of this.btreeIndices) {
                const value = row[colName];
                if (value !== null && value !== undefined) {
                    btree.delete(value, row);
                }
            }

            // Remove from storage (slow, O(N) splice)
            const idx = this.rows.indexOf(row);
            if (idx > -1) {
                this.rows.splice(idx, 1);
            }
        }
        return affected;
    }

    /**
     * Range query methods using B-Tree indices for O(log N) performance
     */

    // Find rows where column > value
    selectGreaterThan(column: string, value: any): Row[] {
        const btree = this.btreeIndices.get(column);
        if (!btree) {
            // Fall back to table scan if no B-Tree index
            return this.rows.filter(row => row[column] > value);
        }
        return btree.greaterThan(value);
    }

    // Find rows where column >= value
    selectGreaterThanOrEqual(column: string, value: any): Row[] {
        const btree = this.btreeIndices.get(column);
        if (!btree) {
            return this.rows.filter(row => row[column] >= value);
        }
        return btree.greaterThanOrEqual(value);
    }

    // Find rows where column < value
    selectLessThan(column: string, value: any): Row[] {
        const btree = this.btreeIndices.get(column);
        if (!btree) {
            return this.rows.filter(row => row[column] < value);
        }
        return btree.lessThan(value);
    }

    // Find rows where column <= value
    selectLessThanOrEqual(column: string, value: any): Row[] {
        const btree = this.btreeIndices.get(column);
        if (!btree) {
            return this.rows.filter(row => row[column] <= value);
        }
        return btree.lessThanOrEqual(value);
    }

    // Find rows where column is between min and max (inclusive)
    selectBetween(column: string, minValue: any, maxValue: any): Row[] {
        const btree = this.btreeIndices.get(column);
        if (!btree) {
            return this.rows.filter(row => row[column] >= minValue && row[column] <= maxValue);
        }
        return btree.range(minValue, maxValue);
    }
}
