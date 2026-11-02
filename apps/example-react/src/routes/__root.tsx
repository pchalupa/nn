import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

import { LanguageSync } from "../components/LanguageSync";

const RootComponent = () => (
	<div className="flex flex-row bg-zinc-900">
		<Suspense fallback={null}>
			<LanguageSync />
		</Suspense>
		<Outlet />
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
