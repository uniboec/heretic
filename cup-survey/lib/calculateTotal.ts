import { getAwardPackageById } from './config/award-packages'
import { BASE_ENTRY_FEE } from './config/pricing'
import { getVenueById } from './config/venues'

export function calculateVenueSubtotal(venueId: string): number | null {
  const venue = getVenueById(venueId)
  if (!venue) return null
  return BASE_ENTRY_FEE + venue.surcharge
}

export function calculateTotalEntryFee(venueId: string, packageId: string): number | null {
  const venue = getVenueById(venueId)
  const package_ = getAwardPackageById(packageId)
  if (!venue || !package_) return null
  return BASE_ENTRY_FEE + venue.surcharge + package_.surcharge
}

/** @deprecated Use calculateTotalEntryFee */
export function calculateTotalSurcharge(venueId: string, packageId: string): number | null {
  const venue = getVenueById(venueId)
  const package_ = getAwardPackageById(packageId)
  if (!venue || !package_) return null
  return venue.surcharge + package_.surcharge
}
