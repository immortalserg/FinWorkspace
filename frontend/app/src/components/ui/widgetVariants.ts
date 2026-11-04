import { cva } from "class-variance-authority";

export const widgetVariants = cva(
  "relative flex flex-col border-2 whitespace-nowrap shadow-md dark:shadow-secondary/50 rounded-3xl",
  {
    variants: {
      size: {
        sm: "size-48",
        md: "w-96 h-48",
        lg: "size-96",
      },
      design: {
        default: "p-6",
        mumbai: "p-4",
      },
      variant: {
        default: "bg-background text-foreground",
        secondary: "bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      size: "sm",
      design: "default",
      variant: "default",
    },
  },
);

