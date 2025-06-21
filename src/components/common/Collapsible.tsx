import React, { useState } from "react";
import { IconRenderer } from "./IconRenderer";

interface CollapsibleProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Collapsible({
  title,
  icon,
  defaultExpanded = false,
  className = "",
  children,
}: CollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`collapsible-container ${className}`}>
      <button
        onClick={handleToggle}
        className="collapsible-trigger cursor-pointer flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100 w-full text-left"
        aria-expanded={isExpanded}
        type="button"
      >
        <IconRenderer
          iconName="ChevronDown"
          className={`collapsible-icon w-4 h-4 transition-transform ${isExpanded ? "expanded" : ""}`}
        />
        {icon && <span className="collapsible-title-icon">{icon}</span>}
        <span>{title}</span>
      </button>
      <div className={`collapsible-content ${isExpanded ? "expanded" : ""}`}>
        <div className="collapsible-inner">{children}</div>
      </div>
    </div>
  );
}
