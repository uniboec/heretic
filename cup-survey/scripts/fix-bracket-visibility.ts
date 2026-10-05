import { prisma } from '../lib/prisma'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'

async function main() {
  const result = await setCategoriesPublicVisibility({ scope: 'all', visible: true })
  console.log(`visible categories: ${result.affectedCategoryKeys.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
