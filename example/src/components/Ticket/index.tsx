interface TicketProps {
	title: string;
}

export const Ticket = ({title}: TicketProps) => {
	const handleDragStart = (event: React.DragEvent) => {
		event.dataTransfer.setData('text/plain', title);
	};

	return (
		<div className='border-2 p-2' draggable onDragStart={handleDragStart}>
			<p>{title}</p>
		</div>
	);
}