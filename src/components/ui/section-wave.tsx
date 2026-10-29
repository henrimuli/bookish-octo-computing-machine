import { cn } from "@/lib/utils";

/** A short, centred wave between page sections, fading out at both ends. */
export function SectionWave({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex justify-center px-4", className)}>
      <svg
        viewBox="0 0 320 16"
        preserveAspectRatio="none"
        className="h-4 w-full max-w-sm text-primary/45 [mask-image:linear-gradient(to_right,transparent,black_30%,black_70%,transparent)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path
          vectorEffect="non-scaling-stroke"
          d="M0 8 Q 20 1 40 8 T 80 8 T 120 8 T 160 8 T 200 8 T 240 8 T 280 8 T 320 8"
        />
      </svg>
    </div>
  );
}
