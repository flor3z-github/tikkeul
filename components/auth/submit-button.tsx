"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "h-12 w-full rounded-full text-[15px] font-semibold",
        className,
      )}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
