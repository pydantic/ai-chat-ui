import { THINKING_EFFORT_LEVELS } from '@/lib/generated/thinking-effort.gen'
import { cn } from '@/lib/utils'

// One height per level; a caller cannot pass a count this cannot draw.
const HEIGHTS = ['h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5', 'h-4']

/**
 * Signal-strength glyph for a thinking-effort level: one rising bar per level, lit up
 * to the chosen one. It turns an abstract setting into something you read at a
 * glance and watch respond when you change it.
 */
export function EffortBars({ level, className }: { level: number; className?: string }) {
  return (
    <span aria-hidden className={cn('flex items-end gap-[2px]', className)}>
      {Array.from({ length: THINKING_EFFORT_LEVELS.length }, (_, index) => (
        <span
          key={index}
          style={{ transitionDelay: `${index * 40}ms` }}
          className={cn(
            'w-[3px] rounded-full transition-all duration-200',
            HEIGHTS[Math.min(index, HEIGHTS.length - 1)],
            index <= level ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        />
      ))}
    </span>
  )
}
