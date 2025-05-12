import { describe, expect, it } from "vitest";
import { MerkleTree } from "./index";

describe("MerkleTree", () => {
	it("should create a Merkle tree", async () => {
		const tree = await MerkleTree.from([]);

		expect(tree.root).toBeUndefined();
	});

	it("should create a Merkle tree", async () => {
		const tree = await MerkleTree.from(["hello", "world", "foo", "bar", "buffer", "baz", "qux", "quux"]);

		expect(tree.root?.hash).toBe("7e2756459dfc17b7b0aea9f509d52ebd99411fb4bbac02b78bac607deddeb77f");
	});
});
