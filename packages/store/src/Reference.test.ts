import { describe, expect, it, vi } from "vitest";
import { Reference } from "./Reference";

describe("Reference", () => {
	it("should create a reference", () => {
		const reference = new Reference(() => "test");

		expect(reference).toHaveProperty("resolve");
		expect(reference).toMatchInlineSnapshot(`
			Reference {
			  "resolve": [Function],
			}
		`);
	});

	it("should create a reference using factory method", () => {
		const reference = Reference.createReferenceFor(() => ({
			id: "test",
		}));

		expect(reference).toBeInstanceOf(Reference);
		expect(reference).toHaveProperty("resolve");
		expect(reference).toMatchInlineSnapshot(`
			{
			  "resolve": undefined,
			}
		`);
	});

	it("should resolve a reference", () => {
		const dataAccessor = vi.fn(() => "test");
		const reference = new Reference(dataAccessor);

		expect(reference.resolve()).toBe("test");
		expect(dataAccessor).toHaveBeenCalled();
	});

	it("should resolve a reference when accessing a property", () => {
		const dataAccessor = vi.fn(() => ({
			id: "test",
		}));
		const reference = Reference.createReferenceFor(dataAccessor);

		expect(reference.id).toBe("test");
		expect(dataAccessor).toHaveBeenCalled();
	});
});
