import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from ".";

describe("Button", () => {
	it("defaults to type button", () => {
		render(<Button>Save</Button>);

		expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("type", "button");
	});

	it("calls onClick", async () => {
		const onClick = vi.fn();

		render(<Button onClick={onClick}>Save</Button>);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(onClick).toHaveBeenCalled();
	});
});
