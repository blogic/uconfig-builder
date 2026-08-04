// The current page's title and its trailing controls, hoisted into the top bar.
//
// Each page declares them next to its own content via <PageHeader>, which
// registers here and renders nothing. TopBar reads the store. This keeps the
// title dynamic (a service name, an interface name, a client count) without a
// switch in App.svelte.

export const page = $state({ title: null, actions: null })

export function page_set(title, actions) {
  page.title = title ?? null
  page.actions = actions ?? null
}

export function page_clear() {
  page.title = null
  page.actions = null
}
