<script lang="ts">
  import { store, doc_export, config_save, saved_names, changes_reset, scope_reset } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import Button from './Button.svelte'
  import ChangesResetModal from './ChangesResetModal.svelte'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes: ChangeEntry[]
    connected?: boolean
    applyError?: string | null
    onApply: () => void
  }

  let { changes, connected = false, applyError = null, onApply }: Props = $props()

  // Grouped by the page an edit was made on rather than by the document domain
  // it landed in, so the heading names the menu entry the user clicked. Keyed on
  // ChangeEntry.scope, which already identifies the owning page.
  const SCOPE_GROUPS: Record<string, { label: string; icon: string }> = {
    unit: { label: 'System › Device', icon: 'bi-shield-check' },
    radios: { label: 'Network › Radios', icon: 'bi-broadcast' },
    interfaces: { label: 'Network › Interfaces', icon: 'bi-ethernet' },
    ntp: { label: 'System › Time', icon: 'bi-clock' }
  }

  // Prefixed scopes carry a name after the colon, so they group by family.
  function group_for(c: ChangeEntry): { label: string; icon: string } {
    if (SCOPE_GROUPS[c.scope]) return SCOPE_GROUPS[c.scope]
    if (c.scope.startsWith('service:')) return { label: 'System › Services', icon: 'bi-hdd-network' }
    if (c.scope.startsWith('include:')) return { label: 'Network › Wireless', icon: 'bi-wifi' }
    // Anything unmapped keeps the document domain, so a new scope degrades to
    // the old behaviour rather than landing in a blank group.
    return { label: c.section, icon: 'bi-sliders' }
  }

  let showReset = $state(false)

  function reset_all() {
    changes_reset()
    showReset = false
  }

  let name = $state(store.loadedFrom && store.loadedFrom !== 'imported' ? store.loadedFrom : '')
  let savedNote = $state('')

  // Entries keep their document order within a group; groups appear in the order
  // they are first seen. Scopes are carried so a group can reset only its own.
  interface Group {
    label: string
    icon: string
    scopes: Set<string>
    items: ChangeEntry[]
  }

  const grouped = $derived.by(() => {
    const map = new Map<string, Group>()
    for (const c of changes) {
      const { label, icon } = group_for(c)
      if (!map.has(label)) map.set(label, { label, icon, scopes: new Set(), items: [] })
      const g = map.get(label)!
      g.scopes.add(c.scope)
      g.items.push(c)
    }
    return [...map.values()]
  })

  // A group may span several scopes (every service, every include), so resetting
  // it restores each one rather than only the first.
  let resetGroup = $state<Group | null>(null)

  function group_reset() {
    if (!resetGroup) return
    for (const scope of resetGroup.scopes) scope_reset(scope)
    resetGroup = null
  }

  const existing = $derived(saved_names())
  const trimmed = $derived(name.trim())
  const overwrites = $derived(trimmed && existing.includes(trimmed))

  function download() {
    const host = store.doc?.unit?.hostname || 'uconfig'
    const blob = new Blob([doc_export()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${host}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function save() {
    if (!trimmed) return
    config_save(trimmed)
    savedNote = t('Saved as "{name}".', { name: trimmed })
  }
</script>

<div class="flex flex-col gap-5">
  {#if changes.length}
    <ul class="divide-y divide-zinc-200 border-b border-zinc-200">
      {#each grouped as g (g.label)}
        <li class="flex items-start gap-3 py-3">
          <i class="bi {g.icon} mt-0.5 flex-shrink-0 text-lg text-zinc-600"></i>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-sm font-semibold text-zinc-900">{t(g.label)}</span>
              <span class="text-xs text-zinc-400">
                {t('{count, plural, one {# change} other {# changes}}', { count: g.items.length })}
              </span>
              <span class="flex-1"></span>
              <button
                type="button"
                class="flex-shrink-0 text-xs font-medium text-accent hover:underline"
                onclick={() => (resetGroup = g)}
              >
                {t('Reset')}
              </button>
            </div>

            <ul class="mt-1">
              {#each g.items as c}
                <li class="flex items-center gap-2 py-0.5 text-xs text-zinc-500">
                  <span class="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-accent"></span>
                  {c.label}
                </li>
              {/each}
            </ul>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-sm text-zinc-500">{t('No changes since this configuration was loaded.')}</p>
  {/if}

  {#if connected}
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon="bi-upload" disabled={!changes.length} onclick={onApply}>
          {t('Apply to device')}
        </Button>
        <Button icon="bi-arrow-counterclockwise" disabled={!changes.length} onclick={() => (showReset = true)}>
          {t('Reset')}
        </Button>
      </div>
      {#if applyError}
        <p class="mt-1 text-[11px] text-red-600">{applyError}</p>
      {/if}
    </div>
  {:else}
    <div>
      <p class="mb-1 text-xs font-medium text-zinc-700">{t('Download')}</p>
      <div class="flex flex-wrap items-center gap-2">
        <Button icon="bi-download" onclick={download}>{t('Download JSON')}</Button>
        <Button icon="bi-arrow-counterclockwise" disabled={!changes.length} onclick={() => (showReset = true)}>
          {t('Reset')}
        </Button>
      </div>
    </div>

    {#if changes.length}
    <div>
      <p class="mb-1 text-xs font-medium text-zinc-700">{t('Save As')}</p>
      <div class="flex items-center gap-2">
        <input
          class="input"
          placeholder={t('configuration name')}
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          data-1p-ignore
          data-lpignore="true"
          bind:value={name}
          oninput={() => (savedNote = '')}
        />
        <Button variant="primary" disabled={!trimmed} onclick={save}>{t('Save')}</Button>
      </div>
      {#if overwrites && !savedNote}
        <p class="mt-1 text-[11px] text-amber-600">{t('Overwrites the saved configuration "{name}".', { name: trimmed })}</p>
      {/if}
      {#if savedNote}
        <p class="mt-1 text-[11px] text-emerald-600">{savedNote}</p>
      {/if}
    </div>
    {/if}
  {/if}
</div>

{#if showReset}
  <ChangesResetModal
    title="Pending changes"
    entries={changes}
    onConfirm={reset_all}
    onCancel={() => (showReset = false)}
  />
{/if}

{#if resetGroup}
  <ChangesResetModal
    title={resetGroup.label}
    entries={resetGroup.items}
    onConfirm={group_reset}
    onCancel={() => (resetGroup = null)}
  />
{/if}
