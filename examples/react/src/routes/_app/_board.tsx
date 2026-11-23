import { createFileRoute, Outlet, useSearch } from "@tanstack/react-router";
import type { Status } from "example-schema";
import { useRef } from "react";

import { Board } from "../../features/board/components/board";
import { TicketModal, type TicketModalHandle } from "../../features/board/components/ticket-modal";
import { useUser } from "../../features/authentication/authentication";
import { draftForBoardSearch, validateBoardSearch } from "../../features/board/board-search";

const BoardPage = () => {
	const search = useSearch({ from: "/_app/_board" });
	const { id: userId } = useUser();
	const ticketModal = useRef<TicketModalHandle>(null);

	const handleNewTicket = (status: Status) =>
		ticketModal.current?.open({ ...draftForBoardSearch(search, userId), status });

	return (
		<>
			<Board search={search} onNewTicket={handleNewTicket} />
			<TicketModal ref={ticketModal} />
			<Outlet />
		</>
	);
};

export const Route = createFileRoute("/_app/_board")({
	validateSearch: validateBoardSearch,
	component: BoardPage,
});
