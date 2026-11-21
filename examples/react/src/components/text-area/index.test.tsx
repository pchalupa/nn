import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TextArea } from ".";

describe("TextArea", () => {
	it("labels the text area", () => {
		render(<TextArea label="Description" defaultValue="First" />);

		expect(screen.getByRole("textbox", { name: "Description" })).toHaveProperty("value", "First");
	});

	it("passes text area props through", async () => {
		const onChange = vi.fn();

		render(<TextArea label="Description" name="description" onChange={onChange} />);
		const textArea = screen.getByRole("textbox", { name: "Description" });

		await userEvent.type(textArea, "a");

		expect(textArea).toHaveProperty("name", "description");
		expect(onChange).toHaveBeenCalled();
	});
});
