interface TicketProps {
	title: string;
	description: string;
	assignee?: string;
	onDragStart?: (event: React.DragEvent) => void;
}

export const Ticket = ({ title, description, assignee, onDragStart: handleDragStart }: TicketProps) => (
	<article className="rounded bg-zinc-400 p-2" draggable onDragStart={handleDragStart}>
		<div className="flex flex-col gap-y-2">
			<h1 className="text-md font-medium">{title}</h1>
			<p className="text-sm font-normal text-neutral-400">{description}</p>
			<p className="text-xs font-medium text-zinc-700">{assignee}</p>
		</div>
	</article>
);
