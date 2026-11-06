import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { i18n } from "../i18n";
import { useUpdate } from "../store";
import { TicketComments } from "./ticket-comments";

function SeedComments() {
	const update = useUpdate();

	useEffect(() => {
		update((draft) => {
			draft.users.push({ id: "reviewer", name: "Description reviewer", passkeys: [] });

			for (const [id, ticketId, authorId, body] of [
				["first", "ticket", "reviewer", "<strong>Missing expected result</strong>"],
				["second", "ticket", "unknown-agent", "Second finding"],
				["other", "other-ticket", "reviewer", "Hidden finding"],
			]) {
				draft.comments.push({
					id,
					ticketId,
					authorId,
					body,
					reviewedDescription: "Input",
					createdAt: "2026-11-06T12:00:00.000Z",
				});
			}
		});
	}, [update]);

	return null;
}

describe("TicketComments", () => {
	it("renders only the ticket's comments with attributed literal text and a timestamp", async () => {
		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<SeedComments />
					<TicketComments ticketId="ticket" />
				</I18nextProvider>,
			),
		);
		expect(await screen.findByText("Description reviewer")).toBeTruthy();
		expect(screen.getByText("unknown-agent")).toBeTruthy();
		expect(screen.getByText("<strong>Missing expected result</strong>").querySelector("strong")).toBeNull();
		expect(screen.queryByText("Hidden finding")).toBeNull();
		expect(screen.getAllByRole("time")[0].getAttribute("datetime")).toBe("2026-11-06T12:00:00.000Z");
	});
});
