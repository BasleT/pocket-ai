type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} aria-hidden="true" />;
}
