<script>
  import { t } from '../i18n.svelte.js'
  import { page } from '../page.svelte.js'

  let {
    sections = [],
    section,
    onSelect,
    deviceModel = null,
    host = null,
    themeMode,
    onToggleTheme,
    onLogout = null,
    railed = false
  } = $props()

  let menuOpen = $state(false)
</script>

<header class="flex flex-shrink-0 items-center border-b border-zinc-200 bg-surface px-4 {railed ? 'gap-0' : 'gap-3'}">
  <!-- With a single section there are no tabs, so the brand takes the width of
       the sidebar and the title lines up with the content column beside it. -->
  <div class="flex items-center gap-2 py-2.5 {railed ? 'w-[156px] flex-shrink-0' : ''}">
    <span class="grid h-6 w-6 place-items-center rounded-base bg-accent text-xs text-white">
      <i class="bi bi-gear-wide-connected"></i>
    </span>
    <span class="text-sm font-semibold text-zinc-900">{t('uConfig')}</span>
  </div>

  {#if sections.length > 1}
    <nav class="flex h-full items-stretch gap-0.5">
      {#each sections as s (s.key)}
        <button
          type="button"
          class="flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition {section === s.key
            ? 'border-accent font-semibold text-accent'
            : 'border-transparent text-zinc-800 hover:text-accent'}"
          onclick={() => onSelect(s.key)}
        >
          <i class="bi {s.icon}"></i>
          {t(s.label)}
        </button>
      {/each}
    </nav>
  {/if}

  {#if railed}
    <!-- Title and actions share the content column: title left, actions right. -->
    <div class="flex min-w-0 flex-1 items-center gap-3 pl-6">
      {#if page.title}
        <h1 class="truncate text-sm font-semibold text-zinc-900">{page.title}</h1>
      {/if}
      <span class="flex-1"></span>
      {#if page.actions}
        <span class="flex flex-shrink-0 items-center gap-2">{@render page.actions()}</span>
      {/if}
    </div>
  {:else}
    <span class="flex-1"></span>
  {/if}

  {#if deviceModel || host}
    <p class="hidden flex-shrink-0 text-xs text-zinc-500 sm:block">
      {#if deviceModel}<span class="font-semibold text-zinc-900">{deviceModel}</span>{/if}
      {#if deviceModel && host} · {/if}{host ?? ''}
    </p>
  {/if}

  <div class="relative ml-3 flex-shrink-0">
    <button type="button" class="btn-sm" aria-label={t('Menu')} aria-haspopup="true" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
      <i class="bi bi-three-dots-vertical"></i>
    </button>
    {#if menuOpen}
      <button type="button" class="fixed inset-0 z-40 cursor-default" aria-label={t('Close menu')} onclick={() => (menuOpen = false)}></button>
      <div class="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-base border border-zinc-200 bg-surface py-1 shadow-flat-lg">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
          onclick={() => { menuOpen = false; onToggleTheme() }}
        >
          <i class="bi {themeMode === 'dark' ? 'bi-sun' : 'bi-moon'} text-zinc-400"></i>
          {themeMode === 'dark' ? t('Light theme') : t('Dark theme')}
        </button>
        {#if onLogout}
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            onclick={() => { menuOpen = false; onLogout() }}
          >
            <i class="bi bi-box-arrow-left text-zinc-400"></i>
            {t('Log out')}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</header>
