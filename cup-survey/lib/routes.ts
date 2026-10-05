/** Public tournament site paths. */
export const routes = {
  home: '/',
  athletes: '/athletes',
  brackets: '/brackets',
  results: '/results',
  resultsRating: '/results/rating',
  resultsFastest: '/results/fastest',
  teams: '/teams',
  normQualifications: '/norms',
  bouts: '/bouts',
  awards: '/awards',
  scoreboard(matIndex: number) {
    return `/scoreboard/${matIndex}` as const
  },
  register: '/registratsiya',
  myRegistrations: '/moi-zayavki',
  registration(id: string) {
    return `/registratsiya/${id}` as const
  },
  edit(token: string) {
    return `/redaktirovanie/${token}` as const
  },
  admin: {
    root: '/admin',
    login: '/admin/login',
    registrations: '/admin/registrations',
    payments: '/admin/payments',
    athletes: '/admin/athletes',
    brackets: '/admin/brackets',
    mandateCommission: '/admin/mandate-commission',
    bouts: '/admin/bouts',
    boutsAudit: '/admin/bouts/audit',
    boutsReconciliation: '/admin/bouts/reconciliation',
    awards: '/admin/awards',
    announcer: '/admin/announcer',
    settings: '/admin/settings',
    athleteRatings: '/admin/athlete-ratings',
    clubs: '/admin/clubs',
    discounts: '/admin/discounts',
    survey: '/admin/survey',
  },
} as const
