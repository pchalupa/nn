import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";

import { i18n } from "./i18n";
import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const root = ReactDOM.createRoot(document.getElementById("app")!);
const router = createRouter({
	routeTree,
});

root.render(
	<StrictMode>
		<I18nextProvider i18n={i18n}>
			<RouterProvider router={router} />
		</I18nextProvider>
	</StrictMode>,
);
