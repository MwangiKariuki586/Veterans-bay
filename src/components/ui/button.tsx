import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "type-control inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-transparent px-5 transition-[background-color,color,border-color,box-shadow,transform] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-55 active:translate-y-px motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-control hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground shadow-control hover:bg-secondary/90",
        outline:
          "border-black/8 bg-white text-foreground hover:border-foreground/15 hover:bg-[#f7f9fa]",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        sm: "min-h-9 px-4",
        default: "min-h-11 px-5",
        lg: "min-h-13 px-7 text-sm",
        icon: "size-11 min-h-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      children,
      className,
      disabled,
      loading = false,
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        className={cn(buttonVariants({ size, variant }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        ref={ref}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Spinner /> : null}
            {children}
          </>
        )}
      </Component>
    );
  },
);

Button.displayName = "Button";
