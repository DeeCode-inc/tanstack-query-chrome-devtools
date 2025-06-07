interface MainLayoutProps {
  listView: React.ReactNode;
  detailView: React.ReactNode;
}

export function MainLayout({ listView, detailView }: MainLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
      {/* Left column - List */}
      {listView}

      {/* Right column - Details */}
      <div className="border border-gray-200 rounded bg-white dark:border-gray-600 dark:bg-gray-800 overflow-hidden flex flex-col min-h-0">
        {detailView}
      </div>
    </div>
  );
}
