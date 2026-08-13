import { useAppStore } from '@/core/stores'
import { StarButton } from '../ui'

/** Bottom-right, floating over the grid — the one place the accent goes big. */
export function CaptureButton() {
  const openCreateModal = useAppStore((s) => s.openCreateModal)

  return (
    <StarButton
      size="w-16 h-16"
      onClick={() => openCreateModal()}
      title="Capture a new card"
      aria-label="Capture a new card"
      className="fixed bottom-8 right-[calc(2rem+var(--scroll-lock,0px))] z-40 text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
      style={
        { '--star-bg': 'var(--accent)', '--star-bg-hover': 'var(--accent-hover)' } as React.CSSProperties
      }
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </StarButton>
  )
}
