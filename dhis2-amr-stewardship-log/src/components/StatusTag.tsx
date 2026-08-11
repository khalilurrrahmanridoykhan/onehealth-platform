import { Tag } from '@dhis2/ui'
import type { AwareCategory } from '../types/stewardship'

const AWARE_PROPS: Record<AwareCategory, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  Access: { positive: true },
  Watch: { neutral: true },
  Reserve: { negative: true },
  'Not classified': { neutral: true },
}

export function AwareTag({ category }: { category: AwareCategory }) {
  return <Tag {...AWARE_PROPS[category]}>{category}</Tag>
}
