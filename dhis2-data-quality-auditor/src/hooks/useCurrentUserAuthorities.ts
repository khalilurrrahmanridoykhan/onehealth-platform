import { useDataQuery } from '@dhis2/app-runtime'

const query = {
  me: {
    resource: 'me',
    params: { fields: 'username,authorities' },
  },
}

interface MeResponse {
  me: { username: string; authorities: string[] }
}

export interface CurrentUserAuthorities {
  loading: boolean
  error: string | null
  username: string
  // Gates the Manage Audits (add/edit/delete) entry point on ALL authority.
  // This is a UI convenience gate, not a real security boundary: classic
  // DHIS2 dataStore has no built-in per-namespace ACL, so any authenticated
  // user with direct API access can still write to this namespace regardless
  // of what this app's UI shows them. Documented plainly in README.md.
  canManage: boolean
}

export function useCurrentUserAuthorities(): CurrentUserAuthorities {
  const { loading, error, data } = useDataQuery<MeResponse>(query)
  const authorities = data?.me.authorities ?? []
  return {
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    username: data?.me.username ?? '',
    canManage: authorities.includes('ALL'),
  }
}
