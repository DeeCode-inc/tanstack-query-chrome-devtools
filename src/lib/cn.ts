import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function that combines clsx and tailwind-merge for intelligent class merging.
 *
 * This function:
 * 1. Uses clsx to handle conditional classes and merge class arrays/objects
 * 2. Uses tailwind-merge to resolve CSS class conflicts intelligently
 *
 * @param inputs - Class values that can be strings, objects, arrays, or conditional
 * @returns A merged string with conflicting classes resolved
 *
 * @example
 * cn("px-2 py-1", "px-4") // "py-1 px-4" (px-2 is overridden)
 * cn("text-red-500", condition && "text-blue-500") // Conditional classes
 * cn({ "bg-blue-500": isActive, "bg-gray-500": !isActive }) // Object syntax
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
