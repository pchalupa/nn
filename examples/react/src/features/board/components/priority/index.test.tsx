import { CaretDownIcon, CaretUpIcon, EqualsIcon, type Icon } from "@phosphor-icons/react";
import { Theme } from "@radix-ui/themes";
import { act, render, screen } from "@testing-library/react";
import { type Priority as TicketPriority, priority } from "example-schema";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n";

import { Priority } from ".";
import { PriorityIcon } from "./parts/priority-icon";

const renderWithTheme = (node: ReactNode) =>
	render(
		<I18nextProvider i18n={i18n}>
			<Theme>{node}</Theme>
		</I18nextProvider>,
	);

describe("Priority", () => {
	afterEach(async () => {
		await act(() => i18n.changeLanguage("en"));
	});

	it("lists priorities from Low to High", () => {
		expect(priority.literals).toStrictEqual(["low", "medium", "high"]);
	});

	it("keeps Low first so old tickets read as Low", () => {
		expect(priority.literals[0]).toBe("low");
	});

	it.each<[TicketPriority, string]>([
		["low", "Low"],
		["medium", "Medium"],
		["high", "High"],
	])("renders %s with its name", (level, name) => {
		renderWithTheme(<Priority priority={level} />);

		expect(screen.getByText(name).classList).toContain("rt-r-weight-medium");
	});

	it.each<[TicketPriority, Icon]>([
		["low", CaretDownIcon],
		["medium", EqualsIcon],
		["high", CaretUpIcon],
	])("draws %s with its icon", (level, Expected) => {
		const drawn = render(<PriorityIcon priority={level} size={12} />);
		const expected = render(<Expected size={12} />);

		expect(drawn.container.querySelector("path")?.getAttribute("d")).toBe(
			expected.container.querySelector("path")?.getAttribute("d"),
		);
	});

	it("names the icon when given a label", () => {
		renderWithTheme(<PriorityIcon priority="high" size={12} label="Priority: High" />);

		expect(screen.getByRole("img", { name: "Priority: High" })).toBeDefined();
	});

	it("hides the icon without a label", () => {
		renderWithTheme(<PriorityIcon priority="low" size={12} />);

		expect(screen.queryByRole("img")).toBeNull();
	});

	it("renders the priority name in Czech", async () => {
		await act(() => i18n.changeLanguage("cs"));

		renderWithTheme(<Priority priority="high" />);

		expect(screen.getByText("Vysoká")).toBeDefined();
	});
});
