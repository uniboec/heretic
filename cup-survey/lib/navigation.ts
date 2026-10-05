import { BASE_PATH } from './basePath'
import { routes } from './routes'

export interface AppNavItem {
  id: string
  href: string
  label: string
  match: (path: string) => boolean
}

export function normalizeAppPath(pathname: string): string {
  const prefix = BASE_PATH
  let normalized = pathname
  if (prefix.length > 0 && pathname.startsWith(prefix)) {
    normalized = pathname.slice(prefix.length) || '/'
  }

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }

  return normalized
}

function matchesHome(path: string) {
  return path === routes.home
}

function matchesAthletes(path: string) {
  return path.startsWith(routes.athletes)
}

function matchesBrackets(path: string) {
  return path.startsWith(routes.brackets)
}

function matchesResultsRating(path: string) {
  return path === routes.resultsRating
}

function matchesResultsFastest(path: string) {
  return path === routes.resultsFastest
}

function matchesResults(path: string) {
  return (
    path === routes.results ||
    path.startsWith(`${routes.results}/`) ||
    path.startsWith('/rezultaty')
  )
}

function matchesTeams(path: string) {
  return path.startsWith(routes.teams)
}

function matchesNormQualifications(path: string) {
  return (
    path.startsWith(routes.normQualifications) ||
    path.startsWith('/norm-qualifications') ||
    path.startsWith('/rank-qualifications') ||
    path.startsWith('/vypolnenie-normativov')
  )
}

function matchesBouts(path: string) {
  return path.startsWith(routes.bouts)
}

function matchesAwards(path: string) {
  return path.startsWith(routes.awards)
}

function matchesRegister(path: string) {
  return path === routes.register
}

function matchesMyRegistrations(path: string) {
  return (
    path.startsWith(routes.myRegistrations) ||
    (path.startsWith(`${routes.register}/`) && path.length > routes.register.length) ||
    path.startsWith('/redaktirovanie/')
  )
}

export function getPublicNavItems(options: {
  bracketsPublicEnabled: boolean
  boutsPublicEnabled: boolean
  awardsPublicEnabled: boolean
  normQualificationsPublicEnabled: boolean
  currentPath?: string
}): AppNavItem[] {
  const path = options.currentPath ?? routes.home
  const showBrackets = options.bracketsPublicEnabled || matchesBrackets(path)
  const showResults = options.bracketsPublicEnabled || matchesResults(path)
  const showTeams = options.bracketsPublicEnabled || matchesTeams(path)
  const showBouts = options.boutsPublicEnabled || matchesBouts(path)

  const items: AppNavItem[] = [
    {
      id: 'home',
      href: routes.home,
      label: 'О турнире',
      match: matchesHome,
    },
    {
      id: 'athletes',
      href: routes.athletes,
      label: 'Участники',
      match: matchesAthletes,
    },
  ]

  if (showBrackets) {
    items.push({
      id: 'brackets',
      href: routes.brackets,
      label: 'Сетки',
      match: matchesBrackets,
    })
  }

  if (showResults) {
    items.push({
      id: 'results',
      href: routes.results,
      label: 'Результаты',
      match: matchesResults,
    })
  }

  if (showTeams) {
    items.push({
      id: 'teams',
      href: routes.teams,
      label: 'Команды',
      match: matchesTeams,
    })
  }

  if (options.normQualificationsPublicEnabled || matchesNormQualifications(path)) {
    items.push({
      id: 'norm-qualifications',
      href: routes.normQualifications,
      label: 'Нормативы',
      match: matchesNormQualifications,
    })
  }

  if (showBouts) {
    items.push({
      id: 'bouts',
      href: routes.bouts,
      label: 'Поединки',
      match: matchesBouts,
    })
  }

  if (options.awardsPublicEnabled) {
    items.push({
      id: 'awards',
      href: routes.awards,
      label: 'Награждение',
      match: matchesAwards,
    })
  }

  items.push({
    id: 'my-registrations',
    href: routes.myRegistrations,
    label: 'Мои заявки',
    match: matchesMyRegistrations,
  })

  return items
}

export function getAdminNavItems(): AppNavItem[] {
  return [
    {
      id: 'registrations',
      href: routes.admin.registrations,
      label: 'Регистрация',
      match: (path) => path.startsWith(routes.admin.registrations),
    },
    {
      id: 'payments',
      href: routes.admin.payments,
      label: 'Оплаты',
      match: (path) => path.startsWith(routes.admin.payments),
    },
    {
      id: 'athletes',
      href: routes.admin.athletes,
      label: 'Спортсмены',
      match: (path) => path.startsWith(routes.admin.athletes),
    },
    {
      id: 'brackets',
      href: routes.admin.brackets,
      label: 'Сетки',
      match: (path) => path.startsWith(routes.admin.brackets),
    },
    {
      id: 'mandate-commission',
      href: routes.admin.mandateCommission,
      label: 'Допуск',
      match: (path) => path.startsWith(routes.admin.mandateCommission),
    },
    {
      id: 'bouts',
      href: routes.admin.bouts,
      label: 'Поединки',
      match: (path) => path.startsWith(routes.admin.bouts),
    },
    {
      id: 'awards',
      href: routes.admin.awards,
      label: 'Награждение',
      match: (path) => path.startsWith(routes.admin.awards),
    },
    {
      id: 'athlete-ratings',
      href: routes.admin.athleteRatings,
      label: 'Рейтинг',
      match: (path) => path.startsWith(routes.admin.athleteRatings),
    },
    {
      id: 'announcer',
      href: routes.admin.announcer,
      label: 'Информатор',
      match: (path) => path.startsWith(routes.admin.announcer),
    },
    {
      id: 'settings',
      href: routes.admin.settings,
      label: 'Настройки',
      match: (path) => path.startsWith(routes.admin.settings),
    },
    {
      id: 'clubs',
      href: routes.admin.clubs,
      label: 'Клубы',
      match: (path) => path.startsWith(routes.admin.clubs),
    },
    {
      id: 'discounts',
      href: routes.admin.discounts,
      label: 'Скидки',
      match: (path) => path.startsWith(routes.admin.discounts),
    },
    {
      id: 'survey',
      href: routes.admin.survey,
      label: 'Опрос',
      match: (path) => path.startsWith(routes.admin.survey),
    },
  ]
}

export function findActiveNavItem(items: AppNavItem[], path: string): AppNavItem | null {
  return items.find((item) => item.match(path)) ?? null
}

export function getPublicPageTitle(path: string): string | null {
  if (matchesRegister(path)) return 'Регистрация'
  if (matchesMyRegistrations(path)) return 'Мои заявки'
  if (matchesAthletes(path)) return 'Участники'
  if (matchesBrackets(path)) return 'Сетки'
  if (matchesResultsRating(path)) return 'Рейтинг'
  if (matchesResultsFastest(path)) return 'Самые быстрые поединки'
  if (matchesResults(path)) return 'Результаты'
  if (matchesTeams(path)) return 'Команды'
  if (matchesNormQualifications(path)) return 'Выполнение нормативов'
  if (matchesBouts(path)) return 'Поединки'
  if (matchesAwards(path)) return 'Награждение'
  if (matchesHome(path)) return 'О турнире'
  return null
}

export function getAdminPageTitle(path: string): string | null {
  return findActiveNavItem(getAdminNavItems(), path)?.label ?? null
}
