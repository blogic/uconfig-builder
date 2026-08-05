import { getContext, setContext } from 'svelte'

export type AccordionId = string

export interface AccordionControl {
  isOpen: (id: AccordionId) => boolean
  toggle: (id: AccordionId) => void
  show: (id: AccordionId) => void
  register: (id: AccordionId) => void
}

const KEY = Symbol('accordion')

// One-open-at-a-time group. Each LayoutRenderer provides its own, so sections
// within a card are mutually exclusive; nested renderers get their own group.
// When `autoFirst` is set, the first item to register opens automatically.
export function accordion_provide(autoFirst = false): AccordionControl {
  let open = $state<AccordionId | null>(null)
  let claimed = false
  const ctl: AccordionControl = {
    isOpen: (id) => open === id,
    toggle: (id) => {
      open = open === id ? null : id
    },
    show: (id) => {
      open = id
    },
    register: (id) => {
      if (claimed) return
      claimed = true
      if (autoFirst && open === null) open = id
    }
  }
  setContext(KEY, ctl)
  return ctl
}

export function accordion_get(): AccordionControl | undefined {
  return getContext(KEY)
}
