import { CheckCircle, ChevronDown, Clock, HelpCircle, Moon, Pause, RotateCw, XCircle, type LucideProps } from "lucide-react";
import type { IconName } from "../../types/query";

const iconMap: Record<IconName, React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>> = {
  CheckCircle,
  XCircle,
  Clock,
  RotateCw,
  HelpCircle,
  Pause,
  Moon,
  ChevronDown,
} as const;

interface IconRendererProps {
  iconName: IconName;
  className?: string;
}

export function IconRenderer({ iconName, className = "w-4 h-4" }: IconRendererProps) {
  const Icon = iconMap[iconName];

  return <Icon className={className} />;
}
