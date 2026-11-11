import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getStyleSheet } from "../styles/css";

interface ShadowHostProps {
	children: ReactNode;
}

export function ShadowHost({ children }: ShadowHostProps) {
	const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;

		if (host) {
			const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });

			root.adoptedStyleSheets = [getStyleSheet()];

			setShadowRoot(root);
		}
	}, []);

	return (
		<div data-nn-devtools="" ref={hostRef}>
			{shadowRoot && createPortal(<div data-devtools="">{children}</div>, shadowRoot)}
		</div>
	);
}
