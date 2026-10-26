"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, type Person } from "@/lib/game";

/** Ring progress around content (level, weekly goal). */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = "#facc15",
  track = "rgba(255,255,255,0.2)",
  children,
  className,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function Stars({
  value,
  max = 3,
  size = 18,
  className,
  animate = false,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${value} of ${max} stars`}
    >
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          style={{
            width: size,
            height: size,
            animationDelay: animate ? `${index * 180 + 150}ms` : undefined,
          }}
          className={cn(
            index < value
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-300",
            animate && index < value ? "game-pop" : "",
          )}
        />
      ))}
    </span>
  );
}

export function PersonAvatar({
  person,
  size = 36,
  className,
}: {
  person:
    | Pick<Person, "firstName" | "lastName" | "profileImage">
    | null
    | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-800",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {person?.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.profileImage}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initials(
          person
            ? { firstName: person.firstName, lastName: person.lastName }
            : null,
        )
      )}
    </span>
  );
}

/** Animated number (counts up to `value`). */
export function CountUp({
  value,
  duration = 900,
}: {
  value: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{shown}</>;
}

/** Stable pseudo-random 0–1 (render stays pure). */
function seeded(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        left: seeded(index, 1) * 100,
        delay: seeded(index, 2) * 0.6,
        duration: 2.2 + seeded(index, 3) * 1.6,
        drift: (seeded(index, 4) - 0.5) * 160,
        color: [
          "#facc15",
          "#22c55e",
          "#38bdf8",
          "#f472b6",
          "#fb923c",
          "#a78bfa",
        ][index % 6],
        rotate: seeded(index, 5) * 360,
      })),
    [pieces],
  );
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
      aria-hidden
    >
      {items.map((item, index) => (
        <span
          key={index}
          className="game-confetti-piece"
          style={
            {
              left: `${item.left}%`,
              background: item.color,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
              transform: `rotate(${item.rotate}deg)`,
              "--drift": `${item.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

const noopSubscribe = () => () => {};

/** Full-screen layer in a portal (above the app chrome and bottom bar). */
export function Overlay({
  children,
  onClose,
  className,
  label,
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  label: string;
}) {
  // false while server-rendering and hydrating, true afterwards
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn("fixed inset-0 z-[60]", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Bottom sheet on phones, centred card on larger screens. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Overlay
      onClose={onClose}
      label={typeof title === "string" ? title : "Dialog"}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl game-rise">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0 flex-1 text-base font-bold text-slate-900">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div
            className="border-t border-slate-100 px-5 py-3"
            style={{
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName = "bg-gradient-to-r from-emerald-500 to-lime-400",
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-100",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          barClassName,
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
