import type { DragEvent } from "react";

interface TicketProps {
	title: string;
	description: string;
	draggable?: boolean;
	onDragStart?: (event: DragEvent) => void;
}

export const Ticket = ({ title, description, draggable = false, onDragStart: handleDragStart }: TicketProps) => (
	<article
		className="cursor-grab rounded bg-zinc-400 p-2 active:cursor-grabbing"
		draggable={draggable}
		onDragStart={handleDragStart}
	>
		<div className="flex flex-col gap-y-2">
			<h1 className="font-medium text-md">{title}</h1>
			<p className="font-normal text-neutral-400 text-sm">{description}</p>
		</div>
	</article>
);
