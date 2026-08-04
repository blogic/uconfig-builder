<script>
  import { request as ws_request, upload as ws_upload } from '../connection.svelte.js'
  import { confirm } from '../confirm.svelte.js'
  import { systemState } from '../system.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'

  let file = $state(null)
  let keepConfig = $state(false)

  function pick(e) {
    file = e.target.files?.[0] ?? null
  }

  async function do_upgrade() {
    if (!file) return
    if (!(await confirm(t('Flash "{name}" and reboot?', { name: file.name }), 'Flash'))) return
    systemState.error = null
    systemState.busy = 'uploading'
    try {
      const tok = await ws_request('sysupgrade', { action: 'token' })
      const res = await ws_upload(tok.upload_url, file)
      systemState.busy = 'upgrading'
      await ws_request('sysupgrade', { action: 'apply', file_id: res.file_id, keep_config: keepConfig })
    } catch (e) {
      systemState.error = e?.message || String(e)
      systemState.busy = null
    }
  }
</script>

<PageHeader title={t('Firmware')} />
<p class="page-description">{t(PAGE_DESCRIPTIONS.firmware)}</p>

<div class="max-w-xl">
  <label class="mb-1 block text-xs font-medium text-zinc-700" for="fw-file">{t('Firmware image')}</label>
  <input
    id="fw-file"
    type="file"
    accept=".bin,.img,application/octet-stream"
    class="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-base file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200"
    onchange={pick}
  />

  <label class="mt-4 flex items-center gap-2 text-sm text-zinc-700">
    <input type="checkbox" bind:checked={keepConfig} />
    {t('Keep current settings')}
  </label>

  {#if systemState.error}
    <p class="mt-3 text-sm text-red-600">{systemState.error}</p>
  {/if}

  <button
    type="button"
    class="btn-primary mt-5 rounded-base px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
    disabled={!file}
    onclick={do_upgrade}
  >
    {t('Flash firmware')}
  </button>
</div>
