import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// biome-ignore lint/style/noNonNullAssertion: This is a root element
const root = ReactDOM.createRoot(document.getElementById("app")!);
const router = createRouter({
	routeTree,
});

root.render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
