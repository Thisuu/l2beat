import { layer2s, layer3s } from '@l2beat/config'
import { ProjectId, UnixTime } from '@l2beat/shared-pure'
import { groupBy } from 'lodash'
import { unstable_noStore as noStore } from 'next/cache'
import { env } from '~/env'
import { db } from '~/server/database'
import { cache } from '~/utils/cache'

export async function getDaProjectsTvl(projectIds: ProjectId[]) {
  if (env.MOCK) {
    return getMockDaProjectsTvl()
  }
  noStore()
  return await getCachedDaProjectsTvl(projectIds)
}

type DaProjectsTvl = Awaited<ReturnType<typeof getCachedDaProjectsTvl>>
const getCachedDaProjectsTvl = cache(
  async (projectIds: ProjectId[]) => {
    const values = await db.value.getLatestValues(projectIds)

    const byProject = groupBy(values, 'projectId')

    const aggregated = Object.entries(byProject).map(([projectId, values]) => {
      const { canonical, external, native } = values.reduce(
        (acc, value) => {
          acc.canonical += value.canonical
          acc.external += value.external
          acc.native += value.native

          return acc
        },
        { canonical: 0n, external: 0n, native: 0n },
      )

      const tvl = canonical + external + native

      return {
        projectId: ProjectId(projectId),
        tvl: Number(tvl),
      }
    })

    return aggregated
  },
  ['daProjectsTvl'],
  { revalidate: 10 * UnixTime.MINUTE },
)

/**
 * @helper
 */
export function pickTvlForProjects(
  aggregate: Awaited<ReturnType<typeof getCachedDaProjectsTvl>>,
) {
  return function (projects: ProjectId[]) {
    const included = aggregate.filter((x) => projects.includes(x.projectId))

    const sum = included.reduce((acc, curr) => acc + curr.tvl, 0)

    // Fiat denomination to cents
    return sum / 100
  }
}

function getMockDaProjectsTvl(): DaProjectsTvl {
  return [...layer2s, ...layer3s].map((project) => ({
    projectId: project.id,
    tvl: 100000,
  }))
}
