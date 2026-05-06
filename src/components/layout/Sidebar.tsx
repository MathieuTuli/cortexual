import { useSpacesStore } from '@/core/stores'
import { SpaceList } from '../spaces/SpaceList'
import { ImportExport } from '../ImportExport'
import { Button } from '../ui'

export function Sidebar() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const setActiveSpace = useSpacesStore((s) => s.setActiveSpace)

  return (
    <aside className="w-64 bg-gradient-to-b from-[#f0f8ff] to-[#d8ecf8] border-r-2 border-[#88b0d0] flex flex-col shadow-y2k">
      {/* Logo */}
      <div className="p-4 border-b-2 border-[#a8d4f0] bg-gradient-to-r from-[#0066cc] to-[#00aaff]">
        <h1 className="font-bold text-xl text-white drop-shadow-sm">
          Cortexual
        </h1>
        <p className="text-xs text-[#b8e0ff] mt-0.5">your second brain</p>
      </div>

      {/* All Cards Button */}
      <div className="p-3 border-b-2 border-[#a8d4f0]">
        <Button
          variant={activeSpaceId === null ? 'primary' : 'default'}
          className="w-full justify-center"
          onClick={() => setActiveSpace(null)}
        >
          All Cards
        </Button>
      </div>

      {/* Spaces */}
      <div className="flex-1 overflow-y-auto">
        <SpaceList />
      </div>

      {/* Import/Export */}
      <div className="flex-shrink-0">
        <ImportExport />
      </div>

      {/* Footer */}
      <div className="p-3 border-t-2 border-[#a8d4f0] bg-gradient-to-b from-[#e8f4fc] to-[#d0e8f8]">
        <p className="text-xs text-text-muted text-center">
          v0.1.0 - local mode
        </p>
      </div>
    </aside>
  )
}
