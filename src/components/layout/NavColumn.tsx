import type { ReactNode } from 'react'
import { ImportExport } from '../ImportExport'

/**
 * The one fixed column. Its top padding clears the floating bar, which now
 * carries home and the page switcher alongside the search field.
 */
export function NavColumn({ children }: { children: ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-80 flex flex-col bg-bg">
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 pt-24 pb-6 space-y-7">{children}</div>
      <ImportExport />
    </aside>
  )
}
