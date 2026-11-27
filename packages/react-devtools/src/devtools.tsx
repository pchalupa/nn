import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "./components/button";
import { Drawer } from "./components/drawer";
import { ShadowHost } from "./components/shadow-host";
import type { Inspectable } from "./inspectable";
import { css } from "./styles/css";
import { Tree } from "./tree";

export interface DevtoolsProps {
	/** Store to inspect */
	store: Inspectable;
}

export default function Devtools({ store }: DevtoolsProps): ReactNode {
	const [open, setOpen] = useState(false);

	const handleOpen = () => setOpen(true);
	const handleClose = () => setOpen(false);

	return createPortal(
		<ShadowHost>
			{open ? (
				<Drawer title="Store" label="Goodstate DevTools" onClose={handleClose}>
					<Tree store={store} />
				</Drawer>
			) : (
				<Button text="DevTools" label="Open Goodstate DevTools" variant="floating" onClick={handleOpen} />
			)}
		</ShadowHost>,
		document.body,
	);
}

css`
	[data-devtools] {
		--z: 2147483647;
		--indent: 12px;

		--gs-font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
		--gs-text-label: 12px;
		--gs-tracking-label: 0.12em;
		--gs-leading-label: 1.4;
		--gs-leading-code: 1.5;

		--gs-space-0-5: 2px;
		--gs-space-1: 4px;
		--gs-space-1-5: 6px;
		--gs-space-2: 8px;
		--gs-space-2-5: 10px;
		--gs-space-3: 12px;
		--gs-space-4: 16px;

		--gs-border-width: 1px;
		--gs-focus-width: 2px;
		--gs-focus-offset: 2px;
		--gs-duration: 120ms;
		--gs-ease: cubic-bezier(0.2, 0, 0, 1);

		--gs-panel-bg: #1c130c;
		--gs-panel-bg-raised: #241810;
		--gs-panel-text: #faf0de;
		--gs-panel-text-muted: #faf0deb3;
		--gs-panel-text-subtle: #faf0de99;
		--gs-panel-label: #b48a55;
		--gs-panel-border: #faf0de26;
		--gs-panel-accent: #d9621e;
		--gs-panel-focus: #e4733a;

		--gs-syntax-default: #faf0de;
		--gs-syntax-keyword: #e4733a;
		--gs-syntax-string: #f5a623;
		--gs-syntax-number: #c7744a;
		--gs-syntax-comment: #b48a55;
		--gs-syntax-punctuation: #faf0deb3;

		color: var(--gs-panel-text);
		font-family: var(--gs-font-mono);
		font-size: var(--gs-text-label);
		line-height: var(--gs-leading-code);
	}

	@media (prefers-reduced-motion: reduce) {
		[data-devtools] {
			--gs-duration: 0ms;
		}
	}
`;
