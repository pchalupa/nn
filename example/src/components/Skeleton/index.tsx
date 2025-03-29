import { type PropsWithChildren, Suspense } from "react";

interface SkeletonProps extends PropsWithChildren {
	width: `w-${string}`;
	height: `h-${string}`;
	className?: string;
}

export const Skeleton = ({ width, height, children, className = "" }: SkeletonProps) => (
	<Suspense
		fallback={
			<div
				role="status"
				className={`${width} ${height} animate-pulse rounded-lg bg-zinc-700 transition-colors duration-200 ${className}`}
			/>
		}
	>
		{children}
	</Suspense>
);
