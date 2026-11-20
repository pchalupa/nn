import { createElement, type ReactNode, StrictMode, lazy, Suspense } from "react";

import type { DevtoolsProps } from "./devtools";

declare const process: { env: { NODE_ENV?: string } };

const LazyDevtools = lazy(() => import("./devtools"));

/**
 * Floating panel with the live store state. It renders only in development or under browser automation.
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
