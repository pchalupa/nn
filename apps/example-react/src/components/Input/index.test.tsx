import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input } from ".";

describe("Input", () => {
	it("labels the input", () => {
		render(<Input label="Title" defaultValue="First" />);

		expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "First");
	});

	it("passes input props through", async () => {
		const onChange = vi.fn();

		render(<Input label="Email" type="email" name="email" onChange={onChange} />);
		const input = screen.getByRole("textbox", { name: "Email" });

		await userEvent.type(input, "a");

		expect(input).toHaveProperty("type", "email");
		expect(input).toHaveProperty("name", "email");
		expect(onChange).toHaveBeenCalled();
	});
});
