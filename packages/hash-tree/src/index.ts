//TODO: sort object keys before hashing

export class MerkleTree {
	private constructor(public root?: MerkleNode) {}

	equals(tree: MerkleTree): boolean {
		return this.root?.hash === tree.root?.hash;
	}

	static async from(values: string[]): Promise<MerkleTree> {
		const nodes = await Promise.all(values.map((value) => MerkleNode.createMerkleNode(value)));

		while (nodes.length > 1) {
			const left = nodes[0];
			const right = nodes[1];

			const val = await hash(left.hash + right.hash);

			nodes.splice(0, 2, new MerkleNode(val, left, right));
		}

		// console.log(JSON.stringify(nodes[0], null, 2));

		return new MerkleTree(nodes[0]);
	}
}

class MerkleNode {
	// public hash: string;

	constructor(
		public hash: string,
		private left?: MerkleNode,
		private right?: MerkleNode,
	) {}

	static async createMerkleNode(data: string, left?: MerkleNode, right?: MerkleNode): Promise<MerkleNode> {
		const val = await hash(data);

		return new MerkleNode(val, left, right);
	}
}

async function hash(data: string): Promise<string> {
	const payload = new TextEncoder().encode(data);
	const hash = await crypto.subtle.digest("SHA-256", payload);

	const hashArray = Array.from(new Uint8Array(hash));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

	return hashHex;
}
