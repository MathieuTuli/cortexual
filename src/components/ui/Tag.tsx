import { clsx } from 'clsx'

interface TagProps {
  children: string
  onClick?: () => void
  onRemove?: () => void
  active?: boolean
  className?: string
}

export function Tag({ children, onClick, onRemove, active, className }: TagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5',
        'font-sans text-[10px]',
        'rounded-full px-1.5 py-0.5',
        'transition-all',
        active
          ? 'bg-gradient-to-b from-[#66ccff] to-[#0066cc] text-white border border-[#004499]'
          : 'bg-gradient-to-b from-white to-[#e8f4fc] text-accent-primary border border-[#a8d4f0] hover:border-accent-primary',
        onClick && 'cursor-pointer hover:shadow-y2k',
        className
      )}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:text-red-500 ml-0.5 font-bold"
        >
          ×
        </button>
      )}
    </span>
  )
}
