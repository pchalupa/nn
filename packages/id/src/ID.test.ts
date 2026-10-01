import { ID } from "@nn/id";
import { expect, it } from "vitest";

it("creates a UUID v4 string through the public API", () => {
	expect(ID.create()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
