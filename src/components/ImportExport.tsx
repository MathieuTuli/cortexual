import { useState } from 'react'
import { importFromDirectory, downloadExport, clearDatabase } from '@/core/utils'
import { useCardsStore } from '@/core/stores'
import { Button, IconButton, ContextMenu, useContextMenu } from './ui'

export function ImportExport() {
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const loadCards = useCardsStore((s) => s.loadCards)
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()

  const handleImportDirectory = async () => {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      setStatus('Directory picker not supported in this browser. Use Chrome or Edge.')
      return
    }

    try {
      const directoryHandle = await window.showDirectoryPicker()

      setIsImporting(true)
      setStatus('Scanning directory...')

      const result = await importFromDirectory(directoryHandle, (progress) => {
        setStatus(progress)
      })

      // Log errors to console before they might get cleared
      if (result.errors.length > 0) {
        console.error('[Import] All errors:', result.errors)
      }

      const statusMsg = `Imported: ${result.imported}, Skipped: ${result.skipped}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ''}`
      setStatus(statusMsg)
      console.log(`[Import] Final result: ${statusMsg}`)

      // Reload cards
      await loadCards()
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setStatus('Import cancelled')
      } else {
        setStatus(`Error: ${(error as Error).message}`)
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setStatus('Exporting...')

    try {
      await downloadExport()
      setStatus('Export complete! Check downloads.')
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear ALL cards and media? This cannot be undone.')) {
      return
    }

    setIsClearing(true)
    setStatus('Clearing database...')

    try {
      await clearDatabase()
      await loadCards()
      setStatus('Database cleared!')
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`)
    } finally {
      setIsClearing(false)
    }
  }

  const handleSettingsClick = (e: React.MouseEvent) => {
    showContextMenu(e, [
      {
        label: isClearing ? 'Clearing...' : 'Clear All Data',
        icon: '🗑️',
        onClick: handleClearDatabase,
        danger: true,
        disabled: isClearing,
      },
    ])
  }

  return (
    <div className="p-3 border-t border-[#a8d4f0]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-text-muted">Import / Export</p>
        <IconButton
          size="sm"
          variant="ghost"
          onClick={handleSettingsClick}
          title="Settings"
        >
          ⚙️
        </IconButton>
      </div>

      <div className="space-y-2">
        <Button
          size="sm"
          variant="primary"
          onClick={handleImportDirectory}
          disabled={isImporting}
          className="w-full text-xs"
        >
          {isImporting ? 'Importing...' : 'Import Directory'}
        </Button>

        <Button
          size="sm"
          variant="default"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full text-xs"
        >
          {isExporting ? 'Exporting...' : 'Export All'}
        </Button>
      </div>

      {/* Status */}
      {status && (
        <p className="text-[10px] text-text-muted mt-2 break-words">
          {status}
        </p>
      )}

      {/* Context Menu */}
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
