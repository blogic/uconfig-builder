<script lang="ts">
  import { tz_keys, tz_browser } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import Button from './Button.svelte'
  import type { Unit } from '../types/uconfig'

  interface Props {
    // The owner of `obj` performs the write; a child mutating a prop it does
    // not own is what Svelte reports as ownership_invalid_mutation.
    onset: (key: string, value: unknown) => void
    obj: Record<string, unknown>
  }

  let { obj, onset }: Props = $props()

  // Reads go through a narrowed view; the prop itself stays the caller's
  // object so mutations keep Svelte's ownership link.
  const o = $derived(obj as Unit)

  const fid = $props.id()
  const value = $derived(o.timezone)
  const options = $derived(value && !tz_keys.includes(value) ? [value, ...tz_keys] : tz_keys)

  const browserTz = tz_browser()
  const matches = $derived(browserTz != null && value === browserTz)

  function onChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (!v) onset('timezone', undefined)
    else onset('timezone', v)
  }

  function sync() {
    if (browserTz) onset('timezone', browserTz)
  }
</script>

<div class="flex flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('Timezone')}</label>
  <div class="flex items-center gap-2">
    <select id={fid} class="input" value={value ?? ''} onchange={onChange}>
      {#each options as tz}
        <option value={tz}>{tz}</option>
      {/each}
    </select>
    {#if browserTz}
      <Button
        variant="primary"
        icon="bi-arrow-repeat"
        disabled={matches}
        title={matches ? t('Already matches this computer') : t('Set to {tz}, the timezone of this computer', { tz: browserTz })}
        onclick={sync}
      />
    {/if}
  </div>
</div>
