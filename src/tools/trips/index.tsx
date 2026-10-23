import { Navigate, Route, Routes } from 'react-router'
import { TripScreen } from './TripScreen'
import { TripsListScreen } from './TripsListScreen'
import { TripsProvider } from './TripsProvider'

/** Outil Voyages (lot 6) : `/voyages`, `/voyages/:tripId/:onglet`. */
export default function TripsTool() {
  return (
    <TripsProvider>
      <Routes>
        <Route index element={<TripsListScreen />} />
        <Route path=":tripId" element={<TripScreen />} />
        <Route path=":tripId/:tab" element={<TripScreen />} />
        <Route path="*" element={<Navigate to="/voyages" replace />} />
      </Routes>
    </TripsProvider>
  )
}
