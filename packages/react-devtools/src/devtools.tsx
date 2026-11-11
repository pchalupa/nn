import type { Store } from "@nn/store";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "./components/button";
import { Drawer } from "./components/drawer";
import { ShadowHost } from "./components/shadow-host";
import { Explorer } from "./explorer";
import { css } from "./styles/css";

export interface DevtoolsProps {
	store: Store;
}

export default function Devtools({ store }: DevtoolsProps) {
	const [open, setOpen] = useState(false);

	const handleOpen = () => setOpen(true);
	const handleClose = () => setOpen(false);

	return createPortal(
		<ShadowHost>
			{open ? (
				<Drawer title="nn" label="nn devtools" onClose={handleClose}>
					<Explorer store={store} />
				</Drawer>
			) : (
				<Button text="⚙️" label="Open nn devtools" variant="floating" onClick={handleOpen} />
			)}
		</ShadowHost>,
		document.body,
	);
}

css`
	[data-devtools] {
		--z: 2147483647;
		--bg: #1e1e1e;
		--bg-raised: #2a2a2a;
		--fg: #d4d4d4;
		--fg-muted: #8b8b8b;
		--border: #3a3a3a;
		--hover: #2d2d2d;
		--selected: #264f78;
		--focus: #4fc1ff;
		--accent: #4fc1ff;
		--flash: #5a4b1e;
		--shadow: rgb(0 0 0 / 50%);
		--syntax-key: #9cdcfe;
		--syntax-string: #ce9178;
		--syntax-number: #b5cea8;
		--syntax-boolean: #569cd6;
		--syntax-null: #808080;
		--space-1: 2px;
		--space-2: 4px;
		--space-3: 8px;
		--space-4: 16px;
		--radius: 4px;
		--indent: 12px;

		color: var(--fg);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
	}
`;
