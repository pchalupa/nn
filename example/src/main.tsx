import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

const root = ReactDOM.createRoot(document.getElementById('app')!);
const router = createRouter({
	routeTree,
});

root.render(<RouterProvider router={router} />);
