import { type OnchainVerifier } from '@l2beat/config'
import { getVerifiersFromConfig } from '@l2beat/config/build/src/projects/other/zk-catalog'
import { type VerifierStatusRecord } from '@l2beat/database'
import { type ChainId, UnixTime, branded } from '@l2beat/shared-pure'
import {
  unstable_cache as cache,
  unstable_noStore as noStore,
} from 'next/cache'
import { z } from 'zod'
import { db } from '~/server/database'

export async function getVerifiers() {
  noStore()

  // unstable-cache is limited - uses JSON.stringify under the hood causing
  // issues with custom VOs like UnixTime - that's why we re-parse the data
  // to coerce it back to the correct types
  const cachedVerifiers = await getCachedVerifiersStatus()
  return VerifiersStatuses.parse(cachedVerifiers)
}

const getCachedVerifiersStatus = cache(
  () => getVerifiersStatusLogic(),
  ['zkCatalogVerifiers'],
  {
    revalidate: 10 * UnixTime.MINUTE,
  },
)

export function getVerifiersStatusLogic(
  findVerifierStatus: (
    address: string,
    chainId: ChainId,
  ) => Promise<
    VerifierStatusRecord | undefined
  > = db.verifierStatus.findVerifierStatus.bind(db.verifierStatus),
  getVerifiers: () => OnchainVerifier[] = getVerifiersFromConfig,
) {
  const verifiers = getVerifiers()

  const coercedQueries = verifiers.map(async (verifier) => {
    const status = await findVerifierStatus(
      verifier.contractAddress.toString(),
      verifier.chainId,
    )

    return {
      address: verifier.contractAddress.toString(),
      timestamp: status ? status.lastUsed.toNumber() : null,
    }
  })

  return Promise.all(coercedQueries)
}

export const VerifierStatus = z.object({
  address: z.string(),
  timestamp: branded(z.number().nullable(), (n) =>
    n ? new UnixTime(n) : null,
  ),
})
export type VerifierStatus = z.infer<typeof VerifierStatus>
export const VerifiersStatuses = z.array(VerifierStatus)
export type VerifiersStatuses = z.infer<typeof VerifiersStatuses>
