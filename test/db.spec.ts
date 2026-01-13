import { expect } from 'chai';
import { Database } from '../src/core/Database';
import * as fs from 'fs';
import * as path from 'path';

describe('Database core (unit)', () => {
  let db: Database;
  const testDir = 'test_db_data';

  beforeEach(() => {
    // Isolated test DB
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    db = new Database(testDir);
  });

  after(() => {
    // Cleanup 
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates a table and performs insert/select', () => {
    const tbl = db.createTable('users', [
      { name: 'id', type: 'string', isPrimaryKey: true },
      { name: 'name', type: 'string' }
    ]);

    tbl.insert({ id: 'u1', name: 'Alice' });
    const rows = tbl.select({});
    expect(rows).to.be.an('array').with.length(1);
    expect(rows[0].name).to.equal('Alice');
  });
});