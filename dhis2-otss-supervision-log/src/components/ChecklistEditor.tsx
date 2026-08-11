import { Button, IconDelete16, InputField } from '@dhis2/ui'
import { MODULE_LABELS, MODULE_TYPES, type ChecklistItem, type ModuleType } from '../types/otss'

interface Props {
  checklist: ChecklistItem[]
  onChange: (checklist: ChecklistItem[]) => void
  registerReviewRequiredSample: number
  onChangeRequiredSample: (n: number) => void
}

// Structured around the paper's real 5 scored OTSS modules (fixed section
// per module type), with items *within* each section fully admin-defined --
// no bundled checklist content ships with this app. The 6th paper module,
// "Feedback and action plans," isn't here: it maps directly to this app's
// own gapsIdentified/actionPlan/followUpDate fields on the visit form
// itself, since that's what it actually is in the source paper too.
export function ChecklistEditor({ checklist, onChange, registerReviewRequiredSample, onChangeRequiredSample }: Props) {
  function itemsFor(moduleType: ModuleType) {
    return checklist.filter((item) => item.moduleType === moduleType)
  }

  function addItem(moduleType: ModuleType) {
    onChange([...checklist, { id: crypto.randomUUID(), moduleType, label: '' }])
  }

  function updateItem(id: string, label: string) {
    onChange(checklist.map((item) => (item.id === id ? { ...item, label } : item)))
  }

  function removeItem(id: string) {
    onChange(checklist.filter((item) => item.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {MODULE_TYPES.map((moduleType) => (
        <div key={moduleType}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{MODULE_LABELS[moduleType]}</div>
          {moduleType === 'RegisterReview' && (
            <div style={{ marginBottom: 12, maxWidth: 320 }}>
              <InputField
                label="Records a supervisor must review for this module to count as complete"
                dense
                type="number"
                value={String(registerReviewRequiredSample)}
                onChange={({ value }) => onChangeRequiredSample(Number(value) || 1)}
                helpText="The source paper used 5 or 10 depending on indicator."
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {itemsFor(moduleType).length === 0 && (
              <div style={{ fontSize: 13, color: '#6e7a89' }}>No items yet -- this module won't count toward completeness until it has at least one.</div>
            )}
            {itemsFor(moduleType).map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <InputField dense value={item.label} onChange={({ value }) => updateItem(item.id, value ?? '')} placeholder="e.g. Correct antimalarial prescribed" />
                </div>
                <Button small icon={<IconDelete16 />} onClick={() => removeItem(item.id)}>
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button small onClick={() => addItem(moduleType)}>
                Add item
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
