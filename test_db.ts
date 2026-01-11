
import { Database } from './src/core/Database';
import { SQLParser } from './src/core/Parser';
import * as fs from 'fs';

// Clean old data
if (fs.existsSync('./data/pesadb.json')) {
    fs.unlinkSync('./data/pesadb.json');
}

const db = new Database();
const parser = new SQLParser(db);

console.log("Running self-test...");

try {
    console.log(parser.execute("CREATE TABLE products (id number pk, name string, price number, stock number)"));
    console.log(parser.execute('INSERT INTO products (id, name, price, stock) VALUES (1, "Laptop", 1200, 10)'));
    console.log(parser.execute('INSERT INTO products (id, name, price, stock) VALUES (2, "Mouse", 25, 50)'));

    const rows = parser.execute("SELECT * FROM products");
    console.log("Select All:", rows);
    if (rows.length !== 2) throw new Error("Insert failed");

    const single = parser.execute("SELECT * FROM products WHERE id=1");
    console.log("Select One:", single);
    if (single[0].name !== "Laptop") throw new Error("Index lookup failed");

    console.log(parser.execute('UPDATE products SET price=20 WHERE id=2'));
    const updated = parser.execute("SELECT * FROM products WHERE id=2");
    if (updated[0].price !== 20) throw new Error("Update failed");

    console.log("Test Passed!");
} catch (e) {
    console.error(e);
}
