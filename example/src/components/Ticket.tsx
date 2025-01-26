interface TicketProps {
	title: string;
	description: string;
	onDragStart?: (event: React.DragEvent) => void;
}

export const Ticket = ({ title, description, onDragStart: handleDragStart }: TicketProps) => (
	<article className="rounded bg-white p-2" draggable onDragStart={handleDragStart}>
		<div className="flex flex-col gap-y-2">
			<h1 className="text-md font-medium">{title}</h1>
			<p className="text-sm font-normal text-neutral-400">{description}</p>
		</div>
	</article>
);
