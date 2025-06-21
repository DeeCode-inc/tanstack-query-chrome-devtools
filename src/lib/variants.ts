import { cva, type VariantProps } from "class-variance-authority";

/**
 * Button component variants using class-variance-authority
 * Maps to our existing CSS design system in src/styles/components.css
 */
export const buttonVariants = cva(
  // Base classes applied to all buttons
  "btn btn-animated",
  {
    variants: {
      variant: {
        blue: "btn-blue",
        orange: "btn-orange",
        gray: "btn-gray",
        pink: "btn-pink",
        green: "btn-green",
        red: "btn-red",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-1.5 text-xs", // Current default from CSS
        lg: "px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "md",
    },
  },
);

/**
 * Status badge component variants
 * Maps to our existing status system in src/styles/components.css
 */
export const statusBadgeVariants = cva(
  // Base classes for status badges
  "status-badge-animated status-transition",
  {
    variants: {
      status: {
        blue: "status status-blue",
        green: "status status-green",
        red: "status status-red",
        yellow: "status status-yellow",
        purple: "status status-purple",
        gray: "status status-gray",
      },
      size: {
        sm: "w-5 h-5 text-xs",
        md: "w-6 h-6 text-xs", // Current default
        lg: "w-7 h-7 text-sm",
      },
    },
    defaultVariants: {
      status: "gray",
      size: "md",
    },
  },
);

/**
 * Toggle group option variants
 * Maps to our existing toggle system in src/styles/components.css
 */
export const toggleOptionVariants = cva(
  // Base classes for toggle options
  "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer",
  {
    variants: {
      state: {
        active: "toggle-option-active",
        inactive: "toggle-option-inactive",
      },
    },
    defaultVariants: {
      state: "inactive",
    },
  },
);

/**
 * Input component variants
 * Maps to our existing form system in src/styles/components.css
 */
export const inputVariants = cva(
  // Base input classes
  "input-base",
  {
    variants: {
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-2 text-sm", // Current default
        lg: "px-4 py-3 text-base",
      },
      state: {
        default: "",
        error: "border-red-500 focus:ring-red-500 focus:border-red-500",
        success: "border-green-500 focus:ring-green-500 focus:border-green-500",
      },
    },
    defaultVariants: {
      size: "md",
      state: "default",
    },
  },
);

/**
 * Chip component variants
 * Small informational tags and labels
 */
export const chipVariants = cva(
  // Base chip classes
  "inline-flex items-center rounded-full text-xs font-medium border",
  {
    variants: {
      variant: {
        gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
        disabled:
          "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
        green:
          "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
        red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700",
        yellow:
          "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700",
      },
      size: {
        sm: "px-2 py-0.5",
        md: "px-2.5 py-1", // Default
        lg: "px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "md",
    },
  },
);

// Export TypeScript types for component props
export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type StatusBadgeVariants = VariantProps<typeof statusBadgeVariants>;
export type ToggleOptionVariants = VariantProps<typeof toggleOptionVariants>;
export type InputVariants = VariantProps<typeof inputVariants>;
export type ChipVariants = VariantProps<typeof chipVariants>;
