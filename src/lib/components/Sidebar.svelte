<script>
  import { t } from '../i18n.svelte.js'
  import { view } from '../view.svelte.js'
  import { SERVICES } from '../services.js'
  import { title_for } from '../schema.js'

  let { section, onSelect, changes = 0, deviceSession = false, onBack = null } = $props()

  // Bootstrap Icons, matching the icons the previous builder used per entry.
  const SERVICE_ICONS = {
    ssh: 'bi-terminal',
    'radius-server': 'bi-shield-lock',
    log: 'bi-journal-text',
    mdns: 'bi-broadcast',
    lldp: 'bi-diagram-3',
    adguardhome: 'bi-shield-slash',
    ieee8021x: 'bi-key',
    'quality-of-service': 'bi-speedometer2',
    tailscale: 'bi-hdd-network'
  }

  const services = SERVICES.filter((s) => s.config)
  let servicesOpen = $state(true)

  const inServices = $derived(services.some((s) => section === `service:${s.config}`))
</script>

<nav class="flex h-full w-[250px] flex-shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-surface">
  {#if deviceSession && onBack}
    <button type="button" class="nav-item" onclick={onBack}>
      <i class="bi bi-arrow-left text-base"></i>
      <span class="flex-1">{t('Back')}</span>
    </button>
  {/if}

  <button type="button" class="nav-item {section === 'unit' ? 'nav-item-active' : ''}" onclick={() => onSelect('unit')}>
    <i class="bi bi-shield-check text-base"></i>
    <span class="flex-1">{t('Unit')}</span>
  </button>

  <button type="button" class="nav-item {section === 'interfaces' ? 'nav-item-active' : ''}" onclick={() => onSelect('interfaces')}>
    <i class="bi bi-ethernet text-base"></i>
    <span class="flex-1">{t('Interfaces')}</span>
  </button>

  <button type="button" class="nav-item {section === 'radios' ? 'nav-item-active' : ''}" onclick={() => onSelect('radios')}>
    <i class="bi bi-broadcast text-base"></i>
    <span class="flex-1">{t('Radios')}</span>
  </button>

  <button
    type="button"
    class="nav-section-header {servicesOpen ? 'nav-section-header-open' : ''} {inServices && !servicesOpen ? 'text-accent' : ''}"
    aria-expanded={servicesOpen}
    onclick={() => (servicesOpen = !servicesOpen)}
  >
    <i class="bi bi-hdd-network text-base"></i>
    <span class="flex-1">{t('Services')}</span>
    <i class="bi {servicesOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-xs text-zinc-400"></i>
  </button>
  {#if servicesOpen}
    {#each services as s (s.config)}
      <button
        type="button"
        class="nav-subitem {section === `service:${s.config}` ? 'nav-subitem-active' : ''}"
        onclick={() => onSelect(`service:${s.config}`)}
      >
        <i class="bi {SERVICE_ICONS[s.config] ?? 'bi-gear'} text-base"></i>
        <span class="flex-1">{title_for(s.config)}</span>
      </button>
    {/each}
  {/if}

  <button type="button" class="nav-item {section === 'changes' ? 'nav-item-active' : ''}" onclick={() => onSelect('changes')}>
    <i class="bi bi-code-square text-base"></i>
    <span class="flex-1">{t('JSON')}</span>
    {#if changes}
      <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">
        {changes}
      </span>
    {/if}
  </button>
</nav>
