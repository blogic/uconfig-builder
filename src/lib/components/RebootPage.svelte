<script>
  import { request as ws_request } from '../connection.svelte.js'
  import { confirm } from '../confirm.svelte.js'
  import { systemState } from '../system.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
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

<div class="page-header">
  <h2 class="page-title">{t('Reboot')}</h2>
</div>
<p class="page-description">{t(PAGE_DESCRIPTIONS.reboot)}</p>

<button type="button" class="btn" onclick={do_reboot}>
  <i class="bi bi-arrow-clockwise"></i>
  {t('Reboot')}
</button>
