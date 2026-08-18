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

// Checking only the literal 'ALL' authority is too strict in practice: many
// real "admin" accounts -- including, confirmed live, DHIS2's own official
// play.dhis2.org demo admin account -- are granted a large enumerated set of
// specific authorities rather than the literal ALL wildcard. Since this gate
// is already documented as a UI convenience, not a real security boundary
// (classic DHIS2 dataStore has no per-namespace ACL regardless of what this
// app's UI shows), being unnecessarily strict here only breaks usability
// without adding real protection. M_dhis-web-app-management (the authority
// to install/manage apps at all) is a reasonable, commonly-granted proxy for
// "this account administers this instance" when ALL isn't present.
const MANAGE_AUTHORITIES = ['ALL', 'M_dhis-web-app-management']

export interface CurrentUserAuthorities {
  loading: boolean
  error: string | null
  username: string
  canManage: boolean
}

export function useCurrentUserAuthorities(): CurrentUserAuthorities {
  const { loading, error, data } = useDataQuery<MeResponse>(query)
  const authorities = data?.me.authorities ?? []
  return {
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    username: data?.me.username ?? '',
    canManage: MANAGE_AUTHORITIES.some((a) => authorities.includes(a)),
  }
}
