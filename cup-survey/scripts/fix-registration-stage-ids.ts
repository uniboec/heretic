import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { loadRegistrationSchedule } from '../lib/registration/schedule'
import { recalculateAllUnpaidEntryPrices } from '../lib/registration/categoryDiscounts'

async function main() {
  const before = await prisma.athlete.count()

  const updated = await prisma.teamRegistration.updateMany({
    where: { registrationStage: 'main' },
    data: { registrationStage: 'regular' },
  })

  if (updated.count > 0) {
    await loadRegistrationSchedule()
    await recalculateAllUnpaidEntryPrices()
  }

  const after = await prisma.athlete.count()
  console.log(
    `Athletes in DB: ${after} (was ${before}). Updated registrationStage main→regular: ${updated.count}.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
