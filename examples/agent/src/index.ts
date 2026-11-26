import { SseSync } from "@nn/sse-sync";
import { Store } from "@nn/store";
import { schema } from "example-schema";

import { descriptionReviewer } from "./agents/description-reviewer";
import logger from "./logger";

const store = new Store(schema);
const sync = new SseSync(store, new URL(process.env.REMOTE_URL ?? "http://localhost:3001/sync"));

sync.onError((error) => logger.error({ err: error }, "Agent error"));
sync.onStateChange((state) => logger.debug({ state }, "Sync state changed"));
sync.connect();

store.onChange(review);

async function review() {
	const agentId = "example-description-reviewer";
	const agentName = "Description reviewer";
	const agentUser = store.query((state) => state.users.find(({ id }) => id === agentId));
	const assigned = store.query((state) =>
		state.boards.flatMap((board) => board.tickets).filter(({ assignee }) => assignee === agentId),
	);

	if (sync.connected) {
		if (!agentUser) {
			store.mutate((draft) => {
				draft.users.push({ id: agentId, name: agentName, passkeys: [] });
			});
		}

		for await (const { id, description } of assigned) {
			const { text } = await descriptionReviewer.generate({ prompt: description.trim() });

			store.mutate((draft) => {
				const reviewTicket = draft.boards.flatMap((board) => board.tickets).find((ticket) => ticket.id === id);

				if (reviewTicket) {
					reviewTicket.assignee = "";
					reviewTicket.comments.push({
						id: crypto.randomUUID(),
						author: agentId,
						createdAt: new Date().toISOString(),
						body: text.trim(),
					});
				}
			});
		}
	}
}
