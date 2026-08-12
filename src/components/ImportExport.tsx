import { useState } from 'react'
import { importFromDirectory, downloadExport, clearDatabase } from '@/core/utils'
import { useCardsStore } from '@/core/stores'
import { ContextMenu, useContextMenu } from './ui'
import { clsx } from 'clsx'

const ICON = {
  import: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />,
  export: <path d="M12 15V3m0 0 4 4m-4-4L8 7M5 21h14" />,
  more: <path d="M12 5h.01M12 12h.01M12 19h.01" />,
}

function Action({
  icon,
  label,
  onClick,
  disabled,
  busy,
}: {
  icon: keyof typeof ICON
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg',
        'text-[11px] font-medium transition-colors',
        'text-text-muted hover:text-text hover:bg-white/60',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        busy && 'animate-pulse'
      )}
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        {ICON[icon]}
      </svg>
      {label}
    </button>
  )
}

export function ImportExport() {
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const loadCards = useCardsStore((s) => s.loadCards)
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()

  const busy = isImporting || isExporting || isClearing

  const handleImportDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      setStatus('Directory picker needs Chrome or Edge.')
      return
    }

    try {
      const directoryHandle = await window.showDirectoryPicker()

      setIsImporting(true)
      setStatus('Scanning directory…')

      const result = await importFromDirectory(directoryHandle, setStatus)

      if (result.errors.length > 0) {
        console.error('[Import] All errors:', result.errors)
      }

      const errors = result.errors.length > 0 ? `, ${result.errors.length} errors` : ''
      setStatus(`Imported ${result.imported}, skipped ${result.skipped}${errors}`)

      await loadCards()
    } catch (error) {
      setStatus(
        (error as Error).name === 'AbortError'
          ? 'Import cancelled'
          : `Error: ${(error as Error).message}`
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setStatus('Exporting…')

    try {
      await downloadExport()
      setStatus('Export complete.')
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearDatabase = async () => {
    if (!confirm('Delete ALL cards and media? This cannot be undone.')) return

    setIsClearing(true)
    setStatus('Clearing…')

    try {
      await clearDatabase()
      await loadCards()
      setStatus('Cleared.')
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="px-3 py-3 mt-auto border-t border-white/50">
      <div className="flex items-center gap-0.5">
        <Action
          icon="import"
          label={isImporting ? 'Importing' : 'Import'}
          onClick={handleImportDirectory}
          disabled={busy}
          busy={isImporting}
        />
        <Action
          icon="export"
          label={isExporting ? 'Exporting' : 'Export'}
          onClick={handleExport}
          disabled={busy}
          busy={isExporting}
        />
        <button
          onClick={(e) =>
            showContextMenu(e, [
              {
                label: isClearing ? 'Clearing…' : 'Clear all data',
                onClick: handleClearDatabase,
                danger: true,
                disabled: isClearing,
              },
            ])
          }
          title="More"
          aria-label="More"
          className="w-7 h-7 flex-shrink-0 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/60 transition-colors"
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            {ICON.more}
          </svg>
        </button>
      </div>

      {status && (
        <p className="text-[10px] leading-snug text-text-muted mt-2 px-1 break-words">{status}</p>
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
    </div>
  )
}
