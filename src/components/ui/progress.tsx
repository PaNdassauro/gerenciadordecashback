"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-primary transition-all",
            indeterminate && "animate-progress"
          )}
          style={indeterminate ? { width: "40%" } : { width: `${value}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
