import { Navigate, Route, Routes } from 'react-router'
import { AgendaScreen } from './AgendaScreen'

/** Outil Agenda (lot 15) : l'agenda Google commun, en lecture, sur `/agenda`. */
export default function AgendaTool() {
  return (
    <Routes>
      <Route index element={<AgendaScreen />} />
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  )
}
