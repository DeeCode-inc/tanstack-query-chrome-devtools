interface SkeletonQueryItemProps {
  isDarkMode: boolean;
  staggerIndex?: number;
}

export function SkeletonQueryItem({ isDarkMode, staggerIndex }: SkeletonQueryItemProps) {
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

      {/* Skeleton query key text */}
      <div className="flex-1">
        <div
          className={`
            skeleton-text w-3/4
            ${isDarkMode ? "skeleton-base-dark" : "skeleton-base"}
          `}
        />
      </div>
    </div>
  );
}

export default SkeletonQueryItem;
