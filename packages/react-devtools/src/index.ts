import { createElement, type ReactNode, StrictMode, lazy, Suspense } from "react";

import type { DevtoolsProps } from "./devtools";

declare const process: { env: { NODE_ENV?: string } };

const LazyDevtools = lazy(() => import("./devtools"));

/**
 * Floating button that opens a drawer with a live tree view of the store state.
 *
 * It renders only when `process.env.NODE_ENV` is `"development"` or the page runs under browser automation, such
 * as Playwright. The panel code is loaded lazily, so production users never download it. It lives in a shadow root,
 * so app styles don't leak in.
 *
 * @example
 * <Devtools store={store} />
 */
export function Devtools(props: DevtoolsProps): ReactNode {
	const isDevelopment = process.env.NODE_ENV === "development";
	const isAutomation = typeof navigator !== "undefined" && navigator.webdriver === true;

	if (isDevelopment || isAutomation) {
		return createElement(
			StrictMode,
			null,
			createElement(Suspense, { fallback: null }, createElement(LazyDevtools, props)),
		);
	}
}
