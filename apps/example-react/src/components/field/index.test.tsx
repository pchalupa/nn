import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from ".";
import { Input } from "../input";

describe("Field", () => {
	it("labels its control", () => {
		render(
			<Field label="Name" hint="Shown on tickets and comments.">
				<Input defaultValue="Jan" />
			</Field>,
		);

		expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Jan");
		expect(screen.getByText("Shown on tickets and comments.")).toBeTruthy();
	});
});
