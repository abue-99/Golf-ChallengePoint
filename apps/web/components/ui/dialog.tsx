"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [inner, setInner] = React.useState(!!open);
  React.useEffect(() => { setInner(!!open); }, [open]);
  const setOpen = (v: boolean) => { setInner(v); onOpenChange?.(v); };
  return <Ctx.Provider value={{ open: inner, setOpen }}>{children}</Ctx.Provider>;
}

export function DialogTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, { onClick: () => ctx.setOpen(true) });
  }
  return <button onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (!ctx.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => ctx.setOpen(false)} />
      <div className={cn("relative z-10 w-full max-w-md rounded-lg border bg-background p-4 shadow-lg", className)}>{children}</div>
    </div>
  );
}

export function DialogHeader({ children }: { children?: React.ReactNode }) {
  return <div className="mb-2">{children}</div>;
}

export function DialogTitle({ children }: { children?: React.ReactNode }) {
  return <div className="text-lg font-semibold">{children}</div>;
}
