import { useDataQuery } from '@dhis2/app-runtime'

const query = {
  me: {
    resource: 'me',
    params: { fields: 'username,authorities,userGroups[id]' },
  },
}

interface MeResponse {
  me: { username: string; authorities: string[]; userGroups: { id: string }[] }
}

// Copied verbatim from the sibling apps' own useCurrentUserAuthorities.ts --
// same reasoning applies unchanged: checking only literal 'ALL' is too
// strict in practice (confirmed live that play.dhis2.org's own demo admin
// account isn't granted the literal ALL wildcard), and this gate is a UI
// convenience only -- the real security boundary for this app is DHIS2's own
// program sharing + org-unit capture scope, enforced server-side regardless
// of what this UI shows or hides.
const MANAGE_AUTHORITIES = ['ALL', 'M_dhis-web-app-management']

export interface CurrentUserAuthorities {
  loading: boolean
  error: string | null
  username: string
  canManage: boolean
  // For the restricted-antibiotic approval feature's canReview check --
  // membership is compared against the admin-configured reviewerGroupId in
  // App.tsx, not resolved here (this hook doesn't know about
  // StewardshipSettings).
  userGroupIds: string[]
}

export function useCurrentUserAuthorities(): CurrentUserAuthorities {
  const { loading, error, data } = useDataQuery<MeResponse>(query)
  const authorities = data?.me.authorities ?? []
  return {
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    username: data?.me.username ?? '',
    canManage: MANAGE_AUTHORITIES.some((a) => authorities.includes(a)),
    userGroupIds: (data?.me.userGroups ?? []).map((g) => g.id),
  }
}
