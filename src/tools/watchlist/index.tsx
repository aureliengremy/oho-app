import { Navigate, Route, Routes } from 'react-router'
import { WatchItemScreen } from './WatchItemScreen'
import { WatchListScreen } from './WatchListScreen'
import { WatchProvider } from './WatchProvider'

/** Outil À regarder (lot 7) : `/a-regarder`, `/a-regarder/:itemId`. */
export default function WatchlistTool() {
  return (
    <WatchProvider>
      <Routes>
        <Route index element={<WatchListScreen />} />
        <Route path=":itemId" element={<WatchItemScreen />} />
        <Route path="*" element={<Navigate to="/a-regarder" replace />} />
      </Routes>
    </WatchProvider>
  )
}
