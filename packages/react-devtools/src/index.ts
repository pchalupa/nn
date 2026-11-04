import { Devtools as DevelopmentDevtools } from "./devtools";

declare const process: { env: { NODE_ENV?: string } };

const shouldRender = () => {
	const isDevelopment = process.env.NODE_ENV === "development";
	const isAutomation = typeof navigator !== "undefined" && navigator.webdriver === true;

	return isDevelopment || isAutomation;
};

export const Devtools = shouldRender() ? DevelopmentDevtools : () => null;
