<script>
  import ChoiceListField from './ChoiceListField.svelte'
  import { interface_services } from '../services.js'

  let { obj, context } = $props()

  const options = $derived(interface_services(context?.role))
</script>

<ChoiceListField {obj} key="services" {options} label="" />
