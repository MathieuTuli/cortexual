import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MasonryGrid } from './MasonryGrid'
import { CreateCardModal } from '../modals/CreateCardModal'
import { EditCardModal } from '../modals/EditCardModal'
import { CardViewModal } from '../modals/CardViewModal'
import { SelectionActionBar } from '../SelectionActionBar'
import { useAppStore } from '@/core/stores'

export function AppShell() {
  const isCreateModalOpen = useAppStore((s) => s.isCreateModalOpen)
  const isEditModalOpen = useAppStore((s) => s.isEditModalOpen)
  const isViewModalOpen = useAppStore((s) => s.isViewModalOpen)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
          <MasonryGrid />
        </main>
      </div>
      {isCreateModalOpen && <CreateCardModal />}
      {isEditModalOpen && <EditCardModal />}
      {isViewModalOpen && <CardViewModal />}
      <SelectionActionBar />
    </div>
  )
}
