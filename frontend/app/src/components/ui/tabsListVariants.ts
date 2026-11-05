import { cva } from "class-variance-authority"

export const tabsListVariants = cva(
  [
    "group/tabs-list items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
    // Touch targets: 36px on phones, back to the compact 32px from `sm` up.
    "group-data-horizontal/tabs:h-9 sm:group-data-horizontal/tabs:h-8",
    // A horizontal strip that runs out of room scrolls instead of crushing its
    // triggers into each other — the failure mode on narrow phones. Hide the
    // scrollbar: it sits inside a 3px-padded pill where it looks like damage.
    "max-w-full group-data-horizontal/tabs:overflow-x-auto group-data-horizontal/tabs:overscroll-x-contain",
    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  ],
  {
    variants: {
      variant: {
        default: "bg-[var(--tabs-list-bg)] border border-[var(--tabs-list-border)] shadow-sm",
        line: "gap-1 bg-[var(--tabs-list-bg)] border border-[var(--tabs-list-border)] shadow-sm",
      },
      fullWidth: {
        true: "flex w-full justify-stretch gap-0.5",
        false: "inline-flex w-fit",
      },
    },
    defaultVariants: {
      variant: "default",
      fullWidth: false,
    },
  }
)

