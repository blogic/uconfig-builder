<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import { page } from '../page.svelte.js'
  import BrandMark from './BrandMark.svelte'
  import Button from './Button.svelte'

  interface Section {
    key: string
    label: string
    icon: string
  }

  interface Props {
    sections?: Section[]
    section: string
    onSelect: (key: string) => void
    deviceModel?: string | null
    host?: string | null
    onLogout?: (() => void) | null
    railed?: boolean
    aligned?: boolean
  }

  let {
    sections = [],
    section,
    onSelect,
    deviceModel = null,
    host = null,
    onLogout = null,
    railed = false,
    aligned = false
  }: Props = $props()

</script>

<header class="flex flex-shrink-0 items-center border-b border-zinc-200 bg-surface px-4 {aligned ? 'gap-0' : 'gap-3'}">
  <!-- Whenever a sidebar is present the brand takes its width, so whatever
       follows -- section tabs, or the page title in the editor -- starts on the
       content column rather than straddling the sidebar edge. -->
  <div class="flex items-center gap-2 py-2.5 {aligned ? 'w-[156px] flex-shrink-0' : ''}">
    <BrandMark size={24} />
    <span class="text-sm font-semibold text-zinc-900">{t('uConfig')}</span>
  </div>

  {#if sections.length > 1}
    <nav class="flex h-full items-stretch gap-0.5 {aligned ? 'pl-3' : ''}">
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

  <!-- Only rendered with a session to end: without one the control would be a
       theme toggle alone, which does not warrant a slot in the bar. -->
  {#if onLogout}
    <div class="ml-3 flex-shrink-0">
      <Button icon="bi-box-arrow-left" title={t('Log out')} onclick={onLogout} />
    </div>
  {/if}
</header>
