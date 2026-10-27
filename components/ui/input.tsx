import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "ui-control h-11 w-full px-3.5 placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "ui-control min-h-40 w-full resize-y p-3.5 leading-6 placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn("ui-control h-11 px-3.5", className)}
      {...props}
    />
  );
}
