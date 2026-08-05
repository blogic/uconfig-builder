<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Props {
    obj: Record<string, unknown>
  }

  let { obj }: Props = $props()

  const fid = $props.id()
  const value = $derived((obj.addressing as string | undefined) ?? 'dynamic')
</script>

<div class="flex flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('Addressing')}</label>
  <input id={fid} class="input" value={t(value)} disabled />
</div>
