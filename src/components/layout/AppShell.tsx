import { useRef, type ReactNode } from 'react'
import { TopBar } from './TopBar'
import { CaptureButton } from './CaptureButton'
import { NavColumn } from './NavColumn'
import { CreateCardModal } from '../modals/CreateCardModal'
import { EditCardModal } from '../modals/EditCardModal'
import { CardViewModal } from '../modals/CardViewModal'
import { SelectionActionBar } from '../SelectionActionBar'
import { SelectionBoxOverlay, useSelectionBox } from '../SelectionBox'
import { useAppStore } from '@/core/stores'

interface AppShellProps {
  nav: ReactNode
  searchPlaceholder: string
  children: ReactNode
}

export function AppShell({ nav, searchPlaceholder, children }: AppShellProps) {
  const isCreateModalOpen = useAppStore((s) => s.isCreateModalOpen)
  const isEditModalOpen = useAppStore((s) => s.isEditModalOpen)
  const isViewModalOpen = useAppStore((s) => s.isViewModalOpen)
  const mainRef = useRef<HTMLElement>(null)
  const { selectionRect } = useSelectionBox(mainRef)

  return (
    <div className="min-h-screen bg-bg">
      <NavColumn>{nav}</NavColumn>

      {/* Top padding clears the floating bar, which the grid scrolls under. */}
      <main ref={mainRef} className="relative ml-80">
        <div className="mx-auto max-w-[1280px] px-10 pt-32 pb-40">{children}</div>
        <SelectionBoxOverlay rect={selectionRect} />
      </main>

      <TopBar placeholder={searchPlaceholder} />
      <CaptureButton />

      {isCreateModalOpen && <CreateCardModal />}
      {isEditModalOpen && <EditCardModal />}
      {isViewModalOpen && <CardViewModal />}
      <SelectionActionBar />
    </div>
  )
}
