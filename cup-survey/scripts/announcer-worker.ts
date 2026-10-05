import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { startAnnouncerWorkerLoop } from '../lib/announcer/worker'

const scopeId = process.env.ANNOUNCER_SCOPE_ID ?? TOURNAMENT_SCOPE_ID

console.info(`[announcer-worker] starting for scope ${scopeId}`)
void startAnnouncerWorkerLoop(scopeId)
