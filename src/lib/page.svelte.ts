import type { Snippet } from 'svelte'

// The current page's title and its trailing controls, hoisted into the top bar.
//
// Each page declares them next to its own content via <PageHeader>, which
// registers here and renders nothing. TopBar reads the store. This keeps the
// title dynamic (a service name, an interface name, a client count) without a
// switch in App.svelte.

interface PageState {
  title: string | null
  actions: Snippet | null
}

export const page: PageState = $state({ title: null, actions: null })

// True when the top bar has room for the page title: the standalone editor,
// which has no section tabs. The live device UI keeps its title in the page.
export const hoisted: { on: boolean } = $state({ on: false })

export function page_set(title?: string | null, actions?: Snippet | null): void {
  page.title = title ?? null
  page.actions = actions ?? null
}

export function page_clear(): void {
  page.title = null
  page.actions = null
}
