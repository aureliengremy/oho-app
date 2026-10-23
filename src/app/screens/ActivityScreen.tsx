import { ActivityFeed } from '@/core/household/ActivityFeed'
import { ScreenHeader } from '@/core/layout/ScreenHeader'

export function ActivityScreen() {
  return (
    <>
      <ScreenHeader title="Activité" back />
      <div className="px-5 pb-8">
        <ActivityFeed limit={50} />
      </div>
    </>
  )
}
