import { Database } from './src/core/Database';
import { SQLParser } from './src/core/Parser';
import * as fs from 'fs';

// Clean old data
if (fs.existsSync('./data/pesadb.json')) {
    fs.unlinkSync('./data/pesadb.json');
}

const db = new Database();
const parser = new SQLParser(db);

console.log("=== PesaDB Enhanced JOIN Demo ===\n");
console.log("🚀 Testing INNER, LEFT, RIGHT JOINs with Hash Join optimization\n");

try {
    // Create customers table
    console.log("1️⃣  Creating 'customers' table...");
    console.log(parser.execute("CREATE TABLE customers (id number pk, name string, email string, city string)"));

    // Create orders table with foreign key reference
    console.log("\n2️⃣  Creating 'orders' table...");
    console.log(parser.execute("CREATE TABLE orders (order_id number pk, customer_id number, amount number, product string, status string)"));

    // Create products table for multiple join testing
    console.log("\n3️⃣  Creating 'products' table...");
    console.log(parser.execute("CREATE TABLE products (product_id number pk, product_name string, category string, price number)"));

    // Insert customers
    console.log("\n4️⃣  Inserting customers...");
    console.log(parser.execute('INSERT INTO customers (id, name, email, city) VALUES (1, "Alice Wanjiru", "alice@example.com", "Nairobi")'));
    console.log(parser.execute('INSERT INTO customers (id, name, email, city) VALUES (2, "Bob Kamau", "bob@example.com", "Mombasa")'));
    console.log(parser.execute('INSERT INTO customers (id, name, email, city) VALUES (3, "Carol Muthoni", "carol@example.com", "Kisumu")'));
    console.log(parser.execute('INSERT INTO customers (id, name, email, city) VALUES (4, "David Ochieng", "david@example.com", "Nakuru")'));

    // Insert orders (some customers have multiple orders, some have none)
    console.log("\n5️⃣  Inserting orders...");
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (101, 1, 1500, "Laptop", "completed")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (102, 2, 300, "Mouse", "pending")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (103, 1, 2500, "Monitor", "completed")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (104, 3, 800, "Keyboard", "completed")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (105, 1, 450, "Webcam", "cancelled")'));
    console.log(parser.execute('INSERT INTO orders (order_id, customer_id, amount, product, status) VALUES (106, 5, 900, "Headphones", "completed")'));
    // Note: customer_id 4 (David) has no orders, customer_id 5 doesn't exist in customers table

    // Test regular SELECTs
    console.log("\n6️⃣  SELECT all customers:");
    console.table(parser.execute("SELECT * FROM customers"));

    console.log("\n7️⃣  SELECT all orders:");
    console.table(parser.execute("SELECT * FROM orders"));

    // =====================================
    // INNER JOIN Tests
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 INNER JOIN TESTS (Only matching records)");
    console.log("=".repeat(60));

    console.log("\n8️⃣  INNER JOIN - Get all orders with customer details:");
    const innerJoin = parser.execute(
        "SELECT * FROM orders INNER JOIN customers ON orders.customer_id = customers.id"
    );
    console.table(innerJoin);
    console.log(`   ✅ Returned ${innerJoin.length} rows (only customers with orders)`);

    console.log("\n9️⃣  INNER JOIN - Select specific columns:");
    const selectiveJoin = parser.execute(
        "SELECT orders.order_id, customers.name, orders.product, orders.amount FROM orders INNER JOIN customers ON orders.customer_id = customers.id"
    );
    console.table(selectiveJoin);

    console.log("\n🔟 INNER JOIN - Using table aliases:");
    const aliasJoin = parser.execute(
        "SELECT o.order_id, c.name, c.city, o.product, o.amount FROM orders o INNER JOIN customers c ON o.customer_id = c.id"
    );
    console.table(aliasJoin);

    // =====================================
    // LEFT JOIN Tests
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 LEFT JOIN TESTS (All left table + matching right)");
    console.log("=".repeat(60));

    console.log("\n1️⃣1️⃣  LEFT JOIN - All customers with their orders (including those with no orders):");
    const leftJoin = parser.execute(
        "SELECT * FROM customers LEFT JOIN orders ON customers.id = orders.customer_id"
    );
    console.table(leftJoin);
    console.log(`   ✅ Returned ${leftJoin.length} rows (includes David who has no orders)`);

    console.log("\n1️⃣2️⃣  LEFT JOIN - Customer names with order details (nulls for customers without orders):");
    const leftJoinSelective = parser.execute(
        "SELECT c.name, c.city, o.order_id, o.product, o.amount FROM customers c LEFT JOIN orders o ON c.id = o.customer_id"
    );
    console.table(leftJoinSelective);

    // =====================================
    // RIGHT JOIN Tests
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 RIGHT JOIN TESTS (All right table + matching left)");
    console.log("=".repeat(60));

    console.log("\n1️⃣3️⃣  RIGHT JOIN - All orders with customer details (including orphan orders):");
    const rightJoin = parser.execute(
        "SELECT * FROM customers RIGHT JOIN orders ON customers.id = orders.customer_id"
    );
    console.table(rightJoin);
    console.log(`   ✅ Returned ${rightJoin.length} rows (includes order 106 with non-existent customer)`);

    console.log("\n1️⃣4️⃣  RIGHT JOIN - Order details with customer names (nulls for orphan orders):");
    const rightJoinSelective = parser.execute(
        "SELECT o.order_id, o.product, o.amount, o.status, c.name, c.email FROM customers c RIGHT JOIN orders o ON c.id = o.customer_id"
    );
    console.table(rightJoinSelective);

    // =====================================
    // WHERE Clause Tests
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 JOIN WITH WHERE CLAUSE TESTS");
    console.log("=".repeat(60));

    console.log("\n1️⃣5️⃣  INNER JOIN with WHERE - Only completed orders:");
    const joinWithWhere1 = parser.execute(
        'SELECT o.order_id, c.name, o.product, o.amount, o.status FROM orders o INNER JOIN customers c ON o.customer_id = c.id WHERE status = "completed"'
    );
    console.table(joinWithWhere1);

    console.log("\n1️⃣6️⃣  INNER JOIN with WHERE - Orders from Nairobi:");
    const joinWithWhere2 = parser.execute(
        'SELECT o.order_id, c.name, c.city, o.product FROM orders o INNER JOIN customers c ON o.customer_id = c.id WHERE city = "Nairobi"'
    );
    console.table(joinWithWhere2);

    console.log("\n1️⃣7️⃣  LEFT JOIN with WHERE - All customers from Mombasa with their orders:");
    const leftJoinWithWhere = parser.execute(
        'SELECT c.name, c.city, o.order_id, o.product FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE city = "Mombasa"'
    );
    console.table(leftJoinWithWhere);

    // =====================================
    // Performance Comparison Visualization
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("⚡ PERFORMANCE IMPROVEMENTS");
    console.log("=".repeat(60));
    console.log("\n📈 Hash Join Algorithm Benefits:");
    console.log("   • Old approach (Nested Loop): O(N × M) complexity");
    console.log("   • New approach (Hash Join): O(N + M) complexity");
    console.log("\n   Example with 1000 customers and 5000 orders:");
    console.log("   • Nested Loop: ~5,000,000 operations");
    console.log("   • Hash Join:   ~6,000 operations");
    console.log("   • Speedup:     833x faster! 🚀\n");

    // =====================================
    // Summary
    // =====================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ ENHANCEMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("\n🎯 New Features Implemented:");
    console.log("   1. ✅ INNER JOIN (existing, now optimized)");
    console.log("   2. ✅ LEFT JOIN (new)");
    console.log("   3. ✅ RIGHT JOIN (new)");
    console.log("   4. ✅ Hash Join optimization (O(N+M) vs O(N×M))");
    console.log("   5. ✅ WHERE clause support in JOINs");
    console.log("   6. ✅ Better null handling for outer joins");
    console.log("   7. ✅ Improved table aliasing");
    console.log("   8. ✅ Enhanced error messages\n");

    console.log("📊 Test Results:");
    console.log(`   • Created 3 tables (customers, orders, products)`);
    console.log(`   • Inserted 4 customers and 6 orders`);
    console.log(`   • Ran 10 different JOIN queries successfully`);
    console.log(`   • Tested all JOIN types with various conditions\n`);

    console.log("🎓 SQL Capabilities Now Supported:");
    console.log("   • SELECT * FROM t1 INNER JOIN t2 ON t1.id = t2.id");
    console.log("   • SELECT * FROM t1 LEFT JOIN t2 ON t1.id = t2.id");
    console.log("   • SELECT * FROM t1 RIGHT JOIN t2 ON t1.id = t2.id");
    console.log("   • SELECT cols FROM t1 JOIN t2 ON ... WHERE condition");
    console.log("   • Table aliases support (SELECT a.col FROM table1 a...)\n");

    console.log("💡 Use Cases:");
    console.log("   • Customer order history (with customers who haven't ordered)");
    console.log("   • Orphan record detection (orders without valid customers)");
    console.log("   • Complex reporting with filters");
    console.log("   • Data quality audits\n");

} catch (e) {
    console.error("\n❌ Error:", e);
}
