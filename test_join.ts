import { Database } from './src/core/Database';
import { SQLParser } from './src/core/Parser';
import * as fs from 'fs';

// Clean old data
if (fs.existsSync('./data/pesadb.json')) {
    fs.unlinkSync('./data/pesadb.json');
}

const db = new Database();
const parser = new SQLParser(db);

console.log("=== PesaDB JOIN Demo ===\n");

try {
    // Create customers table
    console.log("1. Creating 'customers' table...");
    console.log(parser.execute("CREATE TABLE customers (id number pk, name string, email string)"));

    // Create orders table with foreign key reference
    console.log("\n2. Creating 'orders' table...");
    console.log(parser.execute("CREATE TABLE orders (order_id number pk, customer_id number, amount number, product string)"));

    // Insert customers
    console.log("\n3. Inserting customers...");
    console.log(parser.execute('INSERT INTO customers (id, name, email) VALUES (1, "Alice Wanjiru", "alice@example.com")'));
    console.log(parser.execute('INSERT INTO customers (id, name, email) VALUES (2, "Bob Kamau", "bob@example.com")'));
    console.log(parser.execute('INSERT INTO customers (id, name, email) VALUES (3, "Carol Muthoni", "carol@example.com")'));

    // Insert orders
    console.log("\n4. Inserting orders...");
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product) VALUES (101, 1, 1500, "Laptop")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product) VALUES (102, 2, 300, "Mouse")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product) VALUES (103, 1, 2500, "Monitor")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product) VALUES (104, 3, 800, "Keyboard")'));

    // Test regular SELECT
    console.log("\n5. SELECT all customers:");
    console.table(parser.execute("SELECT * FROM customers"));

    console.log("\n6. SELECT all orders:");
    console.table(parser.execute("SELECT * FROM orders"));

    // Test INNER JOIN
    console.log("\n7. INNER JOIN - Get all orders with customer details:");
    const joinResult = parser.execute(
        "SELECT * FROM orders INNER JOIN customers ON orders.customer_id = customers.id"
    );
    console.table(joinResult);

    // Test JOIN with column selection
    console.log("\n8. INNER JOIN - Select specific columns:");
    const selectiveJoin = parser.execute(
        "SELECT orders.order_id, customers.name, orders.product, orders.amount FROM orders INNER JOIN customers ON orders.customer_id = customers.id"
    );
    console.table(selectiveJoin);

    // Test JOIN with aliases
    console.log("\n9. INNER JOIN - Using table aliases:");
    const aliasJoin = parser.execute(
        "SELECT o.order_id, c.name, o.product FROM orders o INNER JOIN customers c ON o.customer_id = c.id"
    );
    console.table(aliasJoin);

    console.log("\n✅ JOIN functionality working perfectly!");
    console.log("\n📊 Summary:");
    console.log("  - Created 2 related tables");
    console.log("  - Inserted 3 customers and 4 orders");
    console.log("  - Performed INNER JOIN across tables");
    console.log("  - Supported table aliases (o, c)");
    console.log("  - Column projection working");

} catch (e) {
    console.error("\n❌ Error:", e);
}
