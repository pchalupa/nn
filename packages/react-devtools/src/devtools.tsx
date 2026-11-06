import type { Store } from "@nn/store";
import { useState } from "react";
import { createPortal } from "react-dom";

import { StorePanel } from "./store-panel";
import { styles } from "./styles";

export interface DevtoolsProps {
	store: Store;
}

export function Devtools({ store }: DevtoolsProps) {
	const [open, setOpen] = useState(false);

	return createPortal(
		<div data-nn-devtools="">
			<style>{styles}</style>
			{open ? (
				<aside className="nn-drawer" aria-label="nn devtools">
					<header className="nn-drawer-bar">
						<span>nn</span>
						<button type="button" className="nn-drawer-close" onClick={() => setOpen(false)}>
							Close
						</button>
					</header>
					<StorePanel store={store} />
				</aside>
			) : (
				<button
					type="button"
					className="nn-drawer-toggle"
					aria-label="Open nn devtools"
					onClick={() => setOpen(true)}
				>
					⚙️
				</button>
			)}
		</div>,
		document.body,
	);
}
