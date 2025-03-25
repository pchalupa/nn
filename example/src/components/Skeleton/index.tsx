interface SkeletonProps {
	width: `w-${string}`;
	height: `h-${string}`;
}

export const Skeleton = ({ width, height }: SkeletonProps) => (
	<div
		role="status"
		className={`${width} ${height} animate-pulse rounded-lg bg-gray-200 transition-colors duration-200`}
	/>
);
