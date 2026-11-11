export function formatTime(time: number): string {
	const date = new Date(time);
	const clock = date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
		hourCycle: "h23",
	});

	return `${date.toLocaleDateString()} ${clock}`;
}
