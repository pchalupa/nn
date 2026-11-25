import { createFileRoute, Outlet, useParams, useSearch } from "@tanstack/react-router";
import type { Status } from "example-schema";
import { useRef } from "react";

import { useUser } from "@/features/authentication/authentication";
import { draftForBoardSearch, validateBoardSearch } from "@/features/board/board-search";
import { Board } from "@/features/board/components/board";
import { TicketModal, type TicketModalHandle } from "@/features/board/components/ticket-modal";

const BoardPage = () => {
	const { boardId } = useParams({ from: "/_app/boards/$boardId" });
	const search = useSearch({ from: "/_app/boards/$boardId" });
	const { id: userId } = useUser();
	const ticketModal = useRef<TicketModalHandle>(null);

	const handleNewTicket = (status: Status) =>
		ticketModal.current?.open({ ...draftForBoardSearch(search, userId), status });

	return (
		<>
			<Board boardId={boardId} search={search} onNewTicket={handleNewTicket} />
			<TicketModal ref={ticketModal} boardId={boardId} />
			<Outlet />
		</>
	);
};

export const Route = createFileRoute("/_app/boards/$boardId")({
	validateSearch: validateBoardSearch,
	component: BoardPage,
});
