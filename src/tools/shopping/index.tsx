import { Navigate, Route, Routes } from 'react-router'
import { CategoriesScreen } from './CategoriesScreen'
import { ListScreen } from './ListScreen'
import { ShoppingProvider } from './ShoppingProvider'

/** Outil Courses (lot 4) : `/courses`, `/courses/liste/:listId`, `/courses/rayons`. */
export default function ShoppingTool() {
  return (
    <ShoppingProvider>
      <Routes>
        <Route index element={<ListScreen />} />
        <Route path="liste/:listId" element={<ListScreen />} />
        <Route path="rayons" element={<CategoriesScreen />} />
        <Route path="*" element={<Navigate to="/courses" replace />} />
      </Routes>
    </ShoppingProvider>
  )
}
