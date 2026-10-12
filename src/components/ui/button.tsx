import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Trailing icons carry .trail (optical padding keys off it). Press 100 ms on a sharp curve, hover 140 ms, trailing icon (.trail) slides 3px.
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,scale] duration-[140ms] ease-out active:scale-[0.96] active:duration-100 active:ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_.trail]:transition-transform [&_.trail]:duration-200 [&_.trail]:ease-out hover:[&_.trail]:translate-x-[0.1875rem]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        event: "border border-event-edge bg-event text-event-foreground hover:brightness-95",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-input bg-card hover:border-ink-2/40 hover:bg-muted",
        secondary: "border border-input bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-ink-2 hover:bg-muted hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-[2.375rem] px-3.5 pointer-coarse:h-11 has-[>svg:first-child:not(.trail)]:ps-3 has-[>svg.trail:last-child]:pe-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs",
        sm: "h-8 gap-1.5 px-3 has-[>svg:first-child:not(.trail)]:ps-2.5 has-[>svg.trail:last-child]:pe-2.5",
        lg: "min-h-[2.875rem] py-2.5 whitespace-normal text-balance px-5 text-[0.9375rem] has-[>svg:first-child:not(.trail)]:ps-4.5 has-[>svg.trail:last-child]:pe-4.5",
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs": "size-6 rounded-sm",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
