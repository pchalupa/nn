import { type PropsWithChildren, Suspense } from "react";

interface SkeletonProps extends PropsWithChildren {
	width: `w-${string}`;
	height: `h-${string}`;
}

export const Skeleton = ({ width, height, children }: SkeletonProps) => (
	<Suspense
		fallback={
			<div
				role="status"
				className={`${width} ${height} animate-pulse rounded-lg bg-gray-200 transition-colors duration-200`}
			/>
		}
	>
		{children}
	</Suspense>
);
