import React from "react";
import { buttonVariants, type ButtonVariants } from "../../lib/variants";
import { clsx } from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * Reusable Button component using CVA variants
 * Provides type-safe variant management with full HTML button props support
 */
export function Button({
  children,
  variant = "gray",
  size = "md",
  className,
  disabled,
  isLoading = false,
  loadingText,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      className={clsx(buttonVariants({ variant, size }), className)}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (loadingText || "Loading...") : children}
    </button>
  );
}

// Export individual button variants for convenience
export const BlueButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="blue" {...props} />
);

export const RedButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="red" {...props} />
);

export const GreenButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="green" {...props} />
);

export const OrangeButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="orange" {...props} />
);

export const PinkButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="pink" {...props} />
);

export const GrayButton = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="gray" {...props} />
);
