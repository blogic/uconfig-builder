<script lang="ts">
  import { request as ws_request } from '../connection.svelte.js'
  import { confirm } from '../confirm.svelte.js'
  import { systemState } from '../system.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import Button from './Button.svelte'
  import { t } from '../i18n.svelte.js'

  async function do_factory_reset(): Promise<void> {
    if (!(await confirm(t('Factory reset the device? All settings will be erased.'), 'Factory reset'))) return
    systemState.error = null
    systemState.busy = 'resetting'
    try {
      await ws_request('factory-reset', {})
    } catch {
      /* socket may drop before reply */
    }
  }
</script>

<PageHeader title={t('Factory Reset')} />
<p class="page-description">{t(PAGE_DESCRIPTIONS['factory-reset'])}</p>

<p class="mb-5 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
  {t('Every setting is erased, including the password and the network configuration. The device returns to its defaults and reboots.')}
</p>

<Button variant="danger" icon="bi-exclamation-triangle" onclick={do_factory_reset}>{t('Factory reset')}</Button>
