import {
  getAllCitiesOfCountry,
  getStatesOfCountry,
} from '@countrystatecity/countries'
import { prisma } from '../src/config/prisma'

export async function seedIndianCities(): Promise<number> {
  const [states, cities] = await Promise.all([
    getStatesOfCountry('IN'),
    getAllCitiesOfCountry('IN'),
  ])
  const stateById = new Map(states.map((state) => [state.id, state.name]))
  const records = cities.flatMap((city) => {
    const stateName = stateById.get(city.state_id)
    if (!stateName) return []
    return [
      {
        sourceId: city.id,
        name: city.name,
        stateName,
        stateCode: city.state_code,
        latitude: city.latitude || null,
        longitude: city.longitude || null,
      },
    ]
  })
  const result = await prisma.indianCity.createMany({
    data: records,
    skipDuplicates: true,
  })
  return result.count
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void seedIndianCities()
    .then((count) => console.info(`Added ${count} Indian city records`))
    .finally(() => prisma.$disconnect())
}
