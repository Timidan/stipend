"use client";

import { Check, CircleNotch, Copy } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface ButtonCopyProps {
  className?: string;
  disabled?: boolean;
  duration?: number;
  idleIcon?: ReactNode;
  /** What gets copied, for the button's accessible name */
  label?: string;
  loadingDuration?: number;
  loadingIcon?: ReactNode;
  onCopy?: () => Promise<void> | void;
  successIcon?: ReactNode;
}

const defaultIcons = {
  idle: <Copy size={16} weight="bold" />,
  loading: (
    <CircleNotch
      className="animate-spin motion-reduce:animate-none"
      size={16}
      weight="bold"
    />
  ),
  success: <Check size={16} weight="bold" />,
};

export default function ButtonCopy({
  onCopy,
  idleIcon = defaultIcons.idle,
  loadingIcon = defaultIcons.loading,
  successIcon = defaultIcons.success,
  className = "",
  duration = 2000,
  loadingDuration = 1000,
  disabled = false,
  label = "",
}: ButtonCopyProps) {
  const [buttonState, setButtonState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const shouldReduceMotion = useReducedMotion();

  const requestId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      requestId.current += 1;
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
    },
    []
  );

  const handleClick = useCallback(async () => {
    if (buttonState === "loading" || buttonState === "success") {
      return;
    }
    const request = ++requestId.current;
    setButtonState("loading");
    try {
      await onCopy?.();
    } catch {
      if (request === requestId.current) {
        setButtonState("error");
      }
      return;
    }
    if (request !== requestId.current) {
      return;
    }
    timers.current = [
      setTimeout(() => setButtonState("success"), loadingDuration),
      setTimeout(() => setButtonState("idle"), loadingDuration + duration),
    ];
  }, [onCopy, loadingDuration, duration, buttonState]);

  const icons = {
    error: idleIcon,
    idle: idleIcon,
    loading: loadingIcon,
    success: successIcon,
  };

  const ariaLabels = {
    error: `Copy failed. Try again`,
    idle: `Copy ${label}`.trim(),
    loading: "Copying…",
    success: "Copied",
  };

  return (
    <div className="flex justify-center">
      <span className="sr-only" role="status">
        {buttonState === "success" ? "Copied" : buttonState === "error" ? "Copy failed" : ""}
      </span>
      <button
        aria-label={ariaLabels[buttonState]}
        className={`relative min-h-[44px] w-auto min-w-[44px] cursor-pointer overflow-hidden rounded-full border bg-background p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${className}`}
        disabled={disabled}
        onClick={handleClick}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { filter: "blur(0px)", opacity: 1, y: 0 }
            }
            className="flex w-full items-center justify-center"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { filter: "blur(10px)", opacity: 0, y: 25 }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { filter: "blur(10px)", opacity: 0, y: -25 }
            }
            key={buttonState}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { bounce: 0, duration: 0.25, type: "spring" as const }
            }
          >
            {icons[buttonState]}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
