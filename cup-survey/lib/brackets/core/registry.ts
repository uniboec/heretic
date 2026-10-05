import type { BracketSystem } from './types'

class BracketSystemRegistryImpl {
  private systems = new Map<string, Map<number, BracketSystem>>()

  register(system: BracketSystem): void {
    const versions = this.systems.get(system.id) ?? new Map()
    versions.set(system.version, system)
    this.systems.set(system.id, versions)
  }

  getLatest(id: string): BracketSystem {
    const system = this.tryGetLatest(id)
    if (!system) throw new Error(`Bracket system not found: ${id}`)
    return system
  }

  tryGetLatest(id: string): BracketSystem | null {
    const versions = this.systems.get(id)
    if (!versions || versions.size === 0) return null
    const latest = Math.max(...versions.keys())
    return versions.get(latest) ?? null
  }

  get(id: string, version: number): BracketSystem {
    const versions = this.systems.get(id)
    const system = versions?.get(version)
    if (!system) throw new Error(`Bracket system not found: ${id} v${version}`)
    return system
  }

  has(id: string, version: number): boolean {
    return Boolean(this.systems.get(id)?.get(version))
  }

  canUnregister(id: string, version: number): boolean {
    return this.has(id, version)
  }

  listIds(): string[] {
    return [...this.systems.keys()]
  }
}

export const BracketSystemRegistry = new BracketSystemRegistryImpl()
