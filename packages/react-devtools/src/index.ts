import { createElement, StrictMode, lazy, Suspense } from "react";

import type { DevtoolsProps } from "./devtools";

declare const process: { env: { NODE_ENV?: string } };

const LazyDevtools = lazy(() => import("./devtools"));

export function Devtools(props: DevtoolsProps) {
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
