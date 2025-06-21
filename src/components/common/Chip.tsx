import React from "react";
import { chipVariants, type ChipVariants } from "../../lib/variants";
import { clsx } from "clsx";

interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    ChipVariants {
  children: React.ReactNode;
}

/**
 * Reusable Chip component using CVA variants
 * Small informational tags and labels with type-safe variant management
 */
export function Chip({
  children,
  variant = "gray",
  size = "md",
  className,
  ...props
}: ChipProps) {
  return (
    <span
      className={clsx(chipVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

// Export variant-specific chips for convenience
export const DisabledChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="disabled" {...props} />
);

export const BlueChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="blue" {...props} />
);

export const GreenChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="green" {...props} />
);

export const RedChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="red" {...props} />
);

export const YellowChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="yellow" {...props} />
);

export const GrayChip = (props: Omit<ChipProps, "variant">) => (
  <Chip variant="gray" {...props} />
);
