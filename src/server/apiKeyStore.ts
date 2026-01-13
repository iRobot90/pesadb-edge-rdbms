import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface StoredKey {
    id: string; // public id
    hashed: string; // hashed token
    role: 'admin' | 'user';
    createdAt: string;
}

export class ApiKeyStore {
    private filePath: string;
    private keys: Map<string, StoredKey> = new Map();

    constructor(dataDir = path.join(process.cwd(), 'data'), file = 'api_keys.json') {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, file);
        this.load();
    }

    private load() {
        if (!fs.existsSync(this.filePath)) return;
        try {
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const arr: StoredKey[] = JSON.parse(raw).keys || [];
            this.keys.clear();
            for (const k of arr) this.keys.set(k.id, k);
        } catch (e) {
            console.error('Failed to load api keys:', e);
        }
    }

    private save() {
        const arr = Array.from(this.keys.values());
        fs.writeFileSync(this.filePath, JSON.stringify({ keys: arr }, null, 2));
    }

    // Create a new API key. Returns the plaintext token (only shown once).
    create(role: 'admin' | 'user') {
        const id = crypto.randomBytes(8).toString('hex');
        const token = crypto.randomBytes(24).toString('hex');
        const hashed = this.hash(token);
        const now = new Date().toISOString();
        const stored: StoredKey = { id, hashed, role, createdAt: now };
        this.keys.set(id, stored);
        this.save();
        return { id, token, role };
    }

    // Remove by id
    revoke(id: string) {
        const ok = this.keys.delete(id);
        if (ok) this.save();
        return ok;
    }

    list() {
        return Array.from(this.keys.values()).map(k => ({ id: k.id, role: k.role, createdAt: k.createdAt }));
    }

    // Validate token and return role or null
    validate(token: string): 'admin' | 'user' | null {
        const hashed = this.hash(token);
        for (const v of this.keys.values()) {
            if (v.hashed === hashed) return v.role;
        }
        return null;
    }

    private hash(token: string) {
        return crypto.createHmac('sha256', 'pesadb_secret_salt').update(token).digest('hex');
    }
}

// Export a singleton used by server
export const apiKeyStore = new ApiKeyStore();
