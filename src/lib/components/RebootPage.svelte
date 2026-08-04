<script>
  import { request as ws_request } from '../connection.svelte.js'
  import { confirm } from '../confirm.svelte.js'
  import { systemState } from '../system.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'

  async function do_reboot() {
    if (!(await confirm(t('Reboot the device now?'), 'Reboot'))) return
    systemState.error = null
    systemState.busy = 'rebooting'
    try {
      await ws_request('reboot', {})
    } catch {
      /* the socket may drop before the reply arrives */
    }
  }
</script>

<PageHeader title={t('Reboot')} />
<p class="page-description">{t(PAGE_DESCRIPTIONS.reboot)}</p>

<button type="button" class="btn" onclick={do_reboot}>
  <i class="bi bi-arrow-clockwise"></i>
  {t('Reboot')}
</button>
