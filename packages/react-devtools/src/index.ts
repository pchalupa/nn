import { createElement, StrictMode } from "react";

import { Devtools as DevelopmentDevtools, type DevtoolsProps } from "./devtools";

declare const process: { env: { NODE_ENV?: string } };

export function Devtools(props: DevtoolsProps) {
	const isDevelopment = process.env.NODE_ENV === "development";
	const isAutomation = typeof navigator !== "undefined" && navigator.webdriver === true;

	if (isDevelopment || isAutomation) {
		return createElement(StrictMode, null, createElement(DevelopmentDevtools, props));
	}
}
