interface TicketProps {
	title: string;
	description: string;
	onDragStart?: (event: React.DragEvent) => void;
}

export const Ticket = ({ title, description, onDragStart: handleDragStart }: TicketProps) => (
	// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-and-drop card, keyboard alternative is out of scope
	<article className="rounded bg-zinc-400 p-2" draggable onDragStart={handleDragStart}>
		<div className="flex flex-col gap-y-2">
			<h1 className="text-md font-medium">{title}</h1>
			<p className="text-sm font-normal text-neutral-400">{description}</p>
		</div>
	</article>
);
