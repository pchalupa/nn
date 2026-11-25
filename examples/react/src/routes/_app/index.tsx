import { createFileRoute } from "@tanstack/react-router";

import { BoardsPage } from "@/features/boards/components/boards-page";

export const Route = createFileRoute("/_app/")({
	component: BoardsPage,
});
