import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CardsView } from './CardsView'
import { RightRail } from './RightRail'
import { CreateCardModal } from '../modals/CreateCardModal'
import { EditCardModal } from '../modals/EditCardModal'
import { CardViewModal } from '../modals/CardViewModal'
import { SelectionActionBar } from '../SelectionActionBar'
import { useAppStore } from '@/core/stores'

export function AppShell() {
  const isCreateModalOpen = useAppStore((s) => s.isCreateModalOpen)
  const isEditModalOpen = useAppStore((s) => s.isEditModalOpen)
  const isViewModalOpen = useAppStore((s) => s.isViewModalOpen)

  const modals = (
    <>
      {isCreateModalOpen && <CreateCardModal />}
      {isEditModalOpen && <EditCardModal />}
      {isViewModalOpen && <CardViewModal />}
    </>
  )

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="glass-divider-r flex">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-8 pt-6 pb-12 max-w-[1400px]">
          <TopBar />
          <CardsView />
        </div>
      </main>
      <div className="glass-divider-l flex">
        <RightRail />
      </div>
      {modals}
      <SelectionActionBar />
    </div>
  )
}
