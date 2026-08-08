<script lang="ts">
  // The guest VLAN, which lives in the shared include rather than in this
  // device's document. Every device carrying guest traffic has to tag it the
  // same way, so the id is one value the venue agrees on and the interface only
  // points at it.
  import { GUEST_VLAN_KEY, overlay_get, overlay_set } from '../includes.js'
  import { VLAN_MAX, VLAN_MIN } from '../interfaces.js'
  import { GUEST_VLAN } from '../wizard.svelte.js'
  import { t } from '../i18n.svelte.js'

  const fid = $props.id()
  const id = $derived((overlay_get(GUEST_VLAN_KEY)?.id as number | undefined) ?? GUEST_VLAN)
  let entry = $state('')
  const shown = $derived(entry === '' ? String(id) : entry)
  const val = $derived(Number(shown))
  const error = $derived(
    !Number.isInteger(val) || val < VLAN_MIN || val > VLAN_MAX ? t('VLAN ID must be 1 to 4094') : ''
  )

  function oninput(e: Event) {
    entry = (e.currentTarget as HTMLInputElement).value
    const n = Number(entry)
    if (entry === '' || !Number.isInteger(n) || n < VLAN_MIN || n > VLAN_MAX) return
    overlay_set(GUEST_VLAN_KEY, { id: n })
  }
</script>

<div class="flex max-w-sm flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('VLAN ID')}</label>
  <input id={fid} class="input" type="number" min={VLAN_MIN} max={VLAN_MAX} value={shown} {oninput} />
  {#if error}<p class="text-[11px] leading-snug text-amber-600">{error}</p>{/if}
  <p class="text-[11px] leading-snug text-zinc-500">
    {t('The tag guest traffic carries on the wire. Shared with every device in the venue, so changing it here changes it for all of them.')}
  </p>
</div>
