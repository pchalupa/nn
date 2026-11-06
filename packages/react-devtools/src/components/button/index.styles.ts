export const styles = `
.button {
	padding: 2px 8px;
	border: 1px solid var(--border);
	border-radius: 4px;
	color: inherit;
	background: transparent;
	font: inherit;
	cursor: pointer;
}
.button[data-variant="floating"] {
	position: fixed;
	right: 12px;
	bottom: 12px;
	z-index: 2147483646;
	padding: 6px 12px;
	border-radius: 999px;
	color: var(--fg);
	background: var(--bg);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
`;
