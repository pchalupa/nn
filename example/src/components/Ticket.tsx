interface TicketProps {
	title: string;
	description: string;
	onDragStart?: (event: React.DragEvent) => void;
}

export const Ticket = ({ title, description, onDragStart: handleDragStart }: TicketProps) => (
	<article className="rounded bg-white p-2" draggable onDragStart={handleDragStart}>
		<div className="flex flex-col gap-y-2">
			<h1 className="font-medium text-md">{title}</h1>
			<p className="font-normal text-neutral-400 text-sm">{description}</p>
		</div>
	</article>
);
