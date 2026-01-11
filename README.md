
# PesaTrack & PesaDB

> **Pesapal Junior Dev Challenge '26 Submission**

**PesaTrack** is a Merchant Transaction Dashboard powered by **PesaDB**, a custom-built, lightweight, embedded Relational Database Management System (RDBMS).

## The Vision: "Payments at the Edge"

In many African markets, internet connectivity can be intermittent. Relying on cloud-only databases for Point-of-Sale (POS) systems can lead to lost transactions. 

**PesaDB** is designed as an **embedded, offline-first SQL engine**. It runs locally on the merchant's device (simulated here via Node.js), ensuring that:
1.  **Zero Latency**: Transactions are recorded instantly in-memory.
2.  **Data Integrity**: Type-safe schema enforcement prevents bad data entry.
3.  **Persistence**: Data is flushed to disk (`pesadb.json`) for durability.
4.  **Simplicity**: A lightweight REPL and SQL interface for easy debugging by support staff.

## Project Structure

- `src/core/`: **The RDBMS Logic**
  - `Table.ts`: Handles row storage, column typing, primary keys, and **indexing** (Hash Maps for O(1) lookups).
  - `Database.ts`: Manages schemas and persistence.
  - `Parser.ts`: A custom Regex-based SQL interpreter.
- `src/repl/`: **Interactive CLI** for database management.
- `src/server/`: A minimal REST API exposing the database.
- `src/client/`: The **Merchant Dashboard** (Frontend).

## 🏁 How to Run

### Optimized for Quick Start
Prerequisites: Node.js (v16+)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Seed Data** (Optional)
   Populate the database with dummy transactions.
   ```bash
   npx ts-node seed.ts
   ```

3. **Run the REPL** (Interactive SQL Mode)
   Access the raw database directly.
   ```bash
   npx ts-node src/repl/index.ts
   ```
   *Try: `SELECT * FROM transactions` or `CREATE TABLE test (id number pk)`*

4. **Run the Merchant Dashboard** (Web App)
   Starts the API server and serves the frontend.
   ```bash
   npx ts-node src/server/index.ts
   ```
   Open **http://localhost:3000** in your browser.

##  Technical Highlights (The "Challenge" Part)

### 1. Custom Indexing Strategy
To ensure `SELECT` and `UPDATE` operations are fast even as transaction history grows, `Table.ts` implements a **Hash Indexing** system.
- Columns marked as `pk` (Primary Key) or `unique` automatically generate an index.
- `SELECT * FROM ... WHERE id=...` runs in **O(1)** time, bypassing full table scans.

### 2. Type Enforcement
The engine strictly enforces data types (`string`, `number`, `boolean`) at the insertion level, mimicking real DB constraints to ensure data quality for financial records.

### 3. ACID-ish Properties
- **Atomicity**: Changes are validated against constraints *before* being committed to the main storage.
- **Durability**: Auto-save triggers on mutations to ensure data persistence.

## Improvements Made
- ~~**B-Tree Indexing**~~  **Fully Implemented**: Range queries (>, <, >=, <=, BETWEEN) with O(log N) performance
- ~~**JOINS**~~  **Fully Implemented**: INNER, LEFT, RIGHT joins with hash optimization (O(N+M)).
- **Binary Storage**: Replacing JSON with a binary format for better space efficiency (deferred for readability).
- **Complex WHERE Clauses**: Full support for AND/OR/NOT operators (coming soon).

---
*Built with ❤️ for Pesapal.*
