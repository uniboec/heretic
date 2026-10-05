import { describe, expect, it } from 'vitest'
import {
  findActiveNavItem,
  getAdminNavItems,
  getPublicNavItems,
  getPublicPageTitle,
  normalizeAppPath,
} from '@/lib/navigation'
import { routes } from '@/lib/routes'

describe('normalizeAppPath', () => {
  it('normalizes public paths', () => {
    expect(normalizeAppPath('/')).toBe('/')
    expect(normalizeAppPath('/athletes')).toBe('/athletes')
    expect(normalizeAppPath('/athletes/')).toBe('/athletes')
  })
})

describe('public navigation', () => {
  const options = {
    bracketsPublicEnabled: true,
    boutsPublicEnabled: true,
    awardsPublicEnabled: true,
    normQualificationsPublicEnabled: false,
  }

  it('highlights home', () => {
    const items = getPublicNavItems({ ...options, currentPath: routes.home })
    expect(findActiveNavItem(items, routes.home)?.label).toBe('О турнире')
  })

  it('highlights athletes', () => {
    const items = getPublicNavItems({ ...options, currentPath: routes.athletes })
    expect(findActiveNavItem(items, routes.athletes)?.label).toBe('Участники')
  })

  it('highlights brackets, bouts, and my registrations', () => {
    expect(
      findActiveNavItem(getPublicNavItems({ ...options, currentPath: routes.brackets }), routes.brackets)
        ?.label,
    ).toBe('Сетки')
    expect(
      findActiveNavItem(getPublicNavItems({ ...options, currentPath: routes.results }), routes.results)
        ?.label,
    ).toBe('Результаты')
    expect(
      findActiveNavItem(getPublicNavItems({ ...options, currentPath: routes.bouts }), routes.bouts)?.label,
    ).toBe('Поединки')
    expect(
      findActiveNavItem(
        getPublicNavItems({ ...options, currentPath: routes.myRegistrations }),
        routes.myRegistrations,
      )?.label,
    ).toBe('Мои заявки')
  })

  it('maps nested registration paths to my registrations', () => {
    const path = routes.registration('abc')
    const items = getPublicNavItems({ ...options, currentPath: path })
    expect(findActiveNavItem(items, path)?.label).toBe('Мои заявки')
    expect(getPublicPageTitle(path)).toBe('Мои заявки')
  })

  it('maps edit token paths to my registrations', () => {
    const path = routes.edit('token-123')
    const items = getPublicNavItems({ ...options, currentPath: path })
    expect(findActiveNavItem(items, path)?.label).toBe('Мои заявки')
  })

  it('returns registration title for register page', () => {
    expect(getPublicPageTitle(routes.register)).toBe('Регистрация')
  })

  it('includes results when brackets are public', () => {
    const items = getPublicNavItems({ ...options, currentPath: routes.home })
    expect(items.some((item) => item.href === routes.results)).toBe(true)
    expect(getPublicPageTitle(routes.results)).toBe('Результаты')
    expect(getPublicPageTitle(routes.resultsRating)).toBe('Рейтинг')
    expect(getPublicPageTitle(routes.resultsFastest)).toBe('Самые быстрые поединки')
  })

  it('shows results nav on deep link when brackets are disabled', () => {
    const items = getPublicNavItems({
      bracketsPublicEnabled: false,
      boutsPublicEnabled: false,
      awardsPublicEnabled: false,
      normQualificationsPublicEnabled: false,
      currentPath: routes.results,
    })
    expect(items.some((item) => item.href === routes.results)).toBe(true)
  })

  it('hides awards nav when disabled even on deep link', () => {
    const items = getPublicNavItems({
      bracketsPublicEnabled: true,
      boutsPublicEnabled: true,
      awardsPublicEnabled: false,
      normQualificationsPublicEnabled: false,
      currentPath: routes.awards,
    })
    expect(items.some((item) => item.href === routes.awards)).toBe(false)
    expect(getPublicPageTitle(routes.awards)).toBe('Награждение')
  })

  it('shows awards nav when enabled', () => {
    const items = getPublicNavItems({
      bracketsPublicEnabled: true,
      boutsPublicEnabled: true,
      awardsPublicEnabled: true,
      normQualificationsPublicEnabled: false,
      currentPath: routes.home,
    })
    expect(items.some((item) => item.href === routes.awards)).toBe(true)
  })

  it('shows norm qualifications nav when enabled', () => {
    const items = getPublicNavItems({
      ...options,
      normQualificationsPublicEnabled: true,
      currentPath: routes.home,
    })
    expect(items.some((item) => item.href === routes.normQualifications)).toBe(true)
    expect(getPublicPageTitle(routes.normQualifications)).toBe('Выполнение нормативов')
  })

  it('shows norm qualifications nav on deep link when disabled globally', () => {
    const items = getPublicNavItems({
      bracketsPublicEnabled: false,
      boutsPublicEnabled: false,
      awardsPublicEnabled: false,
      normQualificationsPublicEnabled: false,
      currentPath: routes.normQualifications,
    })
    expect(items.some((item) => item.href === routes.normQualifications)).toBe(true)
  })
})

describe('admin navigation', () => {
  it('highlights each admin section', () => {
    for (const item of getAdminNavItems()) {
      expect(findActiveNavItem(getAdminNavItems(), item.href)?.label).toBe(item.label)
    }
  })
})
