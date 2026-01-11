import { Row } from './Table';

/**
 * B-Tree Node for indexing
 * Supports range queries: >, <, >=, <=, BETWEEN
 */
class BTreeNode {
    keys: any[];
    values: Row[][];
    children: BTreeNode[];
    isLeaf: boolean;

    constructor(isLeaf: boolean = true) {
        this.keys = [];
        this.values = [];
        this.children = [];
        this.isLeaf = isLeaf;
    }
}

/**
 * Simplified B-Tree implementation for range queries
 * Optimized for read-heavy workloads (merchant transactions)
 */
export class BTreeIndex {
    private root: BTreeNode;
    private order: number; // Maximum number of children per node
    private columnName: string;

    constructor(columnName: string, order: number = 5) {
        this.columnName = columnName;
        this.order = order;
        this.root = new BTreeNode(true);
    }

    /**
     * Insert a row into the B-Tree index
     */
    insert(key: any, row: Row): void {
        if (key === null || key === undefined) return;

        const root = this.root;

        // If root is full, split it
        if (root.keys.length >= (2 * this.order - 1)) {
            const newRoot = new BTreeNode(false);
            newRoot.children.push(this.root);
            this.splitChild(newRoot, 0);
            this.root = newRoot;
        }

        this.insertNonFull(this.root, key, row);
    }

    private insertNonFull(node: BTreeNode, key: any, row: Row): void {
        let i = node.keys.length - 1;

        if (node.isLeaf) {
            // Insert into leaf node
            node.keys.push(null);
            node.values.push([]);

            while (i >= 0 && key < node.keys[i]) {
                node.keys[i + 1] = node.keys[i];
                node.values[i + 1] = node.values[i];
                i--;
            }

            node.keys[i + 1] = key;
            if (!node.values[i + 1]) {
                node.values[i + 1] = [];
            }
            node.values[i + 1].push(row);
        } else {
            // Find child to insert into
            while (i >= 0 && key < node.keys[i]) {
                i--;
            }
            i++;

            if (node.children[i].keys.length >= (2 * this.order - 1)) {
                this.splitChild(node, i);
                if (key > node.keys[i]) {
                    i++;
                }
            }

            this.insertNonFull(node.children[i], key, row);
        }
    }

    private splitChild(parent: BTreeNode, index: number): void {
        const order = this.order;
        const fullChild = parent.children[index];
        const newChild = new BTreeNode(fullChild.isLeaf);

        const midIndex = order - 1;

        // Move half of keys to new child
        newChild.keys = fullChild.keys.splice(midIndex + 1);
        newChild.values = fullChild.values.splice(midIndex + 1);

        // Move median key up to parent
        const medianKey = fullChild.keys.pop()!;
        const medianValue = fullChild.values.pop()!;

        parent.keys.splice(index, 0, medianKey);
        parent.values.splice(index, 0, medianValue);
        parent.children.splice(index + 1, 0, newChild);

        // Move children if not leaf
        if (!fullChild.isLeaf) {
            newChild.children = fullChild.children.splice(midIndex + 1);
        }
    }

    /**
     * Search for exact match (single value)
     */
    search(key: any): Row[] {
        return this.searchNode(this.root, key);
    }

    private searchNode(node: BTreeNode, key: any): Row[] {
        let i = 0;

        while (i < node.keys.length && key > node.keys[i]) {
            i++;
        }

        if (i < node.keys.length && key === node.keys[i]) {
            return node.values[i] || [];
        }

        if (node.isLeaf) {
            return [];
        }

        return this.searchNode(node.children[i], key);
    }

    /**
     * Range query: Find all values >= minKey and <= maxKey
     */
    range(minKey: any, maxKey: any): Row[] {
        const results: Row[] = [];
        this.rangeSearch(this.root, minKey, maxKey, results);
        return results;
    }

    private rangeSearch(node: BTreeNode, minKey: any, maxKey: any, results: Row[]): void {
        let i = 0;

        for (i = 0; i < node.keys.length; i++) {
            // Recurse on child if not leaf
            if (!node.isLeaf) {
                this.rangeSearch(node.children[i], minKey, maxKey, results);
            }

            // Check if key is in range
            if (node.keys[i] >= minKey && node.keys[i] <= maxKey) {
                results.push(...node.values[i]);
            }

            // Stop if we've passed the range
            if (node.keys[i] > maxKey) {
                return;
            }
        }

        // Check last child if not leaf
        if (!node.isLeaf) {
            this.rangeSearch(node.children[i], minKey, maxKey, results);
        }
    }

    /**
     * Greater than query: Find all values > key
     */
    greaterThan(key: any): Row[] {
        const results: Row[] = [];
        this.greaterThanSearch(this.root, key, results);
        return results;
    }

    private greaterThanSearch(node: BTreeNode, key: any, results: Row[]): void {
        let i = 0;

        for (i = 0; i < node.keys.length; i++) {
            if (!node.isLeaf) {
                this.greaterThanSearch(node.children[i], key, results);
            }

            if (node.keys[i] > key) {
                results.push(...node.values[i]);
            }
        }

        if (!node.isLeaf) {
            this.greaterThanSearch(node.children[i], key, results);
        }
    }

    /**
     * Greater than or equal query: Find all values >= key
     */
    greaterThanOrEqual(key: any): Row[] {
        const results: Row[] = [];
        this.greaterThanOrEqualSearch(this.root, key, results);
        return results;
    }

    private greaterThanOrEqualSearch(node: BTreeNode, key: any, results: Row[]): void {
        let i = 0;

        for (i = 0; i < node.keys.length; i++) {
            if (!node.isLeaf) {
                this.greaterThanOrEqualSearch(node.children[i], key, results);
            }

            if (node.keys[i] >= key) {
                results.push(...node.values[i]);
            }
        }

        if (!node.isLeaf) {
            this.greaterThanOrEqualSearch(node.children[i], key, results);
        }
    }

    /**
     * Less than query: Find all values < key
     */
    lessThan(key: any): Row[] {
        const results: Row[] = [];
        this.lessThanSearch(this.root, key, results);
        return results;
    }

    private lessThanSearch(node: BTreeNode, key: any, results: Row[]): void {
        for (let i = 0; i < node.keys.length; i++) {
            if (!node.isLeaf) {
                this.lessThanSearch(node.children[i], key, results);
            }

            if (node.keys[i] < key) {
                results.push(...node.values[i]);
            } else {
                // Stop searching if we've reached a key >= target
                return;
            }
        }

        if (!node.isLeaf && node.keys.length > 0) {
            const lastKey = node.keys[node.keys.length - 1];
            if (lastKey < key) {
                this.lessThanSearch(node.children[node.children.length - 1], key, results);
            }
        }
    }

    /**
     * Less than or equal query: Find all values <= key
     */
    lessThanOrEqual(key: any): Row[] {
        const results: Row[] = [];
        this.lessThanOrEqualSearch(this.root, key, results);
        return results;
    }

    private lessThanOrEqualSearch(node: BTreeNode, key: any, results: Row[]): void {
        for (let i = 0; i < node.keys.length; i++) {
            if (!node.isLeaf) {
                this.lessThanOrEqualSearch(node.children[i], key, results);
            }

            if (node.keys[i] <= key) {
                results.push(...node.values[i]);
            } else {
                return;
            }
        }

        if (!node.isLeaf && node.keys.length > 0) {
            const lastKey = node.keys[node.keys.length - 1];
            if (lastKey <= key) {
                this.lessThanOrEqualSearch(node.children[node.children.length - 1], key, results);
            }
        }
    }

    /**
     * Delete a row from the index
     */
    delete(key: any, row: Row): void {
        const rows = this.searchNode(this.root, key);
        if (rows && rows.length > 0) {
            const index = rows.indexOf(row);
            if (index > -1) {
                rows.splice(index, 1);
            }
        }
    }

    /**
     * Get all rows in sorted order (in-order traversal)
     */
    getAllSorted(): Row[] {
        const results: Row[] = [];
        this.inOrderTraversal(this.root, results);
        return results;
    }

    private inOrderTraversal(node: BTreeNode, results: Row[]): void {
        for (let i = 0; i < node.keys.length; i++) {
            if (!node.isLeaf) {
                this.inOrderTraversal(node.children[i], results);
            }
            results.push(...node.values[i]);
        }

        if (!node.isLeaf && node.children.length > node.keys.length) {
            this.inOrderTraversal(node.children[node.children.length - 1], results);
        }
    }

    /**
     * Get statistics about the B-Tree
     */
    getStats(): { height: number; nodeCount: number; keyCount: number } {
        return {
            height: this.getHeight(this.root),
            nodeCount: this.countNodes(this.root),
            keyCount: this.countKeys(this.root)
        };
    }

    private getHeight(node: BTreeNode): number {
        if (node.isLeaf) return 1;
        return 1 + this.getHeight(node.children[0]);
    }

    private countNodes(node: BTreeNode): number {
        let count = 1;
        if (!node.isLeaf) {
            for (const child of node.children) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    private countKeys(node: BTreeNode): number {
        let count = node.keys.length;
        if (!node.isLeaf) {
            for (const child of node.children) {
                count += this.countKeys(child);
            }
        }
        return count;
    }
}
