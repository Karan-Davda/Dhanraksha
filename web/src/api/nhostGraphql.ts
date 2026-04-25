import type { NhostClient } from '@nhost/nhost-js'

export class GraphQLOperationError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.details = details
  }
}

export async function nhostGraphql<TData, TVars extends Record<string, unknown> = Record<string, never>>(
  nhost: NhostClient,
  query: string,
  variables?: TVars,
): Promise<TData> {
  const res = await nhost.graphql.request<TData, TVars>({ query, variables })
  if (res.body.errors?.length) {
    throw new GraphQLOperationError(res.body.errors[0]?.message || 'GraphQL error', res.body.errors)
  }
  if (!res.body.data) {
    throw new GraphQLOperationError('No data returned from GraphQL.')
  }
  return res.body.data
}


