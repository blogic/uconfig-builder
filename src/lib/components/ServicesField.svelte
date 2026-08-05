<script lang="ts">
  import ChoiceListField from './ChoiceListField.svelte'
  import { interface_services } from '../services.js'
  import type { LayoutContext } from '../layouts'

  interface Props {
    obj: Record<string, unknown>
    context?: LayoutContext
  }

  let { obj, context }: Props = $props()

  const options = $derived(interface_services(context?.role))
</script>

<ChoiceListField {obj} key="services" {options} label="" />
