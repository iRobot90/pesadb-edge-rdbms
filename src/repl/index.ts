
import * as readline from 'readline';
import { Database } from '../core/Database';
import { SQLParser } from '../core/Parser';

const db = new Database();
db.load();
const parser = new SQLParser(db);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'PesaDB> '
});

console.log("Welcome to PesaDB v1.0 [Embedded Merchant SQL Engine]");
console.log("Type commands or 'exit' to quit.");

rl.prompt();

rl.on('line', (line) => {
    const input = line.trim();
    if (input.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
    }

    try {
        const result = parser.execute(input);
        if (Array.isArray(result)) {
            console.table(result);
        } else {
            console.log(result);
        }
    } catch (e: any) {
        console.error(`Error: ${e.message}`);
    }
    rl.prompt();
}).on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
});
