"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "ghost" | "outline" | "destructive";
type ButtonSize = "default" | "sm" | "icon" | "icon-sm";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {

    const variants = {
      default: "bg-green-700 text-white hover:bg-green-600",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-red-600 text-white hover:bg-red-700",
    } as const satisfies Record<ButtonVariant, string>;

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3",
      icon: "h-10 w-10 p-0",
      "icon-sm": "h-8 w-8 p-0",
    } as const satisfies Record<ButtonSize, string>;

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";