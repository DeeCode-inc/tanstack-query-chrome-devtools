interface SkeletonMutationItemProps {
  isDarkMode: boolean;
  staggerIndex?: number;
}

export function SkeletonMutationItem({ isDarkMode, staggerIndex }: SkeletonMutationItemProps) {
  // Apply stagger animation if staggerIndex is provided
  const staggerStyle = staggerIndex !== undefined ? {
    '--stagger-index': staggerIndex
  } as React.CSSProperties : {};

  return (
    <div
      style={staggerStyle}
      className={`
        card-list-item skeleton-item
        flex items-center gap-3 p-3
        ${staggerIndex !== undefined ? "list-item-stagger" : ""}
      `}
    >
      {/* Skeleton badge */}
      <div
        className={`
          skeleton-badge
          ${isDarkMode ? "skeleton-base-dark" : "skeleton-base"}
        `}
      />

      {/* Skeleton mutation text */}
      <div className="flex-1 space-y-1">
        <div
          className={`
            skeleton-text w-2/3
            ${isDarkMode ? "skeleton-base-dark" : "skeleton-base"}
          `}
        />
        <div
          className={`
            skeleton-text-sm w-1/2
            ${isDarkMode ? "skeleton-base-dark" : "skeleton-base"}
          `}
        />
      </div>
    </div>
  );
}

export default SkeletonMutationItem;
