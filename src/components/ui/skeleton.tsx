import { cn } from "@/lib/utils"
import { Skeleton as AnimalSkeleton } from "animal-island-ui"
import { useTheme } from "@/lib/theme"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  const { family } = useTheme()

  if (family === "animal-island") {
    return (
      <AnimalSkeleton
        variant="rect"
        heightValue="2rem"
        className={cn("animal-island-skeleton", className)}
        {...props}
      />
    )
  }

  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
