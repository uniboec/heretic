import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const announcerRouteConfig = {
  dynamic: 'force-dynamic' as const,
  revalidate: 0,
}

export const announcerHeaders = NO_STORE_HEADERS
