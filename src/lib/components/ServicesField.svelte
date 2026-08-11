<script lang="ts">
  import ChoiceListField from './ChoiceListField.svelte'
  import { interface_services } from '../services.js'
  import type { LayoutContext } from '../layouts'

  interface Props {
    obj: Record<string, unknown>
    context?: LayoutContext
  }

  let { obj, context }: Props = $props()

  // `modules` arrives through the layout context. Reading the connection here
  // would put the websocket behind every schema form, since LayoutRenderer
  // imports this widget statically.
  const options = $derived(interface_services(context?.role, context?.modules ?? null))

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<ChoiceListField {obj} onset={(k, v) => field_set(obj, k, v)} key="services" {options} label="" />
