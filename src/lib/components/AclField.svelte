<script lang="ts">
  import ArrayListField from './ArrayListField.svelte'
  import { def_get, ref_resolve } from '../schema.js'
  import { t } from '../i18n.svelte.js'

  interface Props {
    // The owner of `obj` performs the write; a child mutating a prop it does
    // not own is what Svelte reports as ownership_invalid_mutation.
    onset: (key: string, value: unknown) => void
    obj: Record<string, unknown>
  }

  let { obj, onset }: Props = $props()

  const KEY = 'access-control-list'
  const fid = $props.id()
  const acl = $derived(obj[KEY] as Record<string, unknown> | undefined)
  const mode = $derived((acl?.mode as 'allow' | 'deny' | undefined) ?? 'disabled')
  const macSchema = ref_resolve(def_get('interface.ssid.acl') ?? {}).properties?.['mac-address'] ?? {}

  function onMode(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (v === 'disabled') {
      onset(KEY, undefined)
    } else {
      if (!obj[KEY] || typeof obj[KEY] !== 'object') onset(KEY, {})
      ;(obj[KEY] as Record<string, unknown>).mode = v
    }
  }

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-1">
    <label for={fid} class="text-xs font-medium text-zinc-700">{t('Access Control List')}</label>
    <select id={fid} class="input" value={mode} onchange={onMode}>
      <option value="disabled">{t('disabled')}</option>
      <option value="allow">{t('allow')}</option>
      <option value="deny">{t('deny')}</option>
    </select>
  </div>
  {#if acl}
    <ArrayListField obj={acl} onset={(k, v) => field_set(acl as Record<string, unknown>, k, v)} key="mac-address" schema={macSchema} label="" />
  {/if}
</div>
