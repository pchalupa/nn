interface TicketProps {
	title: string;
	description: string;
	status: string;
	onDragStart?: (event: React.DragEvent) => void;
}

export const Ticket = ({ title, description, status, onDragStart: handleDragStart }: TicketProps) => (
	<article className="border-2 p-2" draggable onDragStart={handleDragStart}>
		<h1>{title}</h1>
		<p>{description}</p>
		<p>{status}</p>
	</article>
);
