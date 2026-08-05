<script lang="ts">
  import { store, doc_export, config_save, saved_names } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes: ChangeEntry[]
    connected?: boolean
    applyError?: string | null
    onApply: () => void
  }

  let { changes, connected = false, applyError = null, onApply }: Props = $props()

  // Matched to the sidebar entry for each domain, so a change reads as
  // belonging to the page it was made on.
  const SECTION_ICONS: Record<string, string> = {
    Unit: 'bi-shield-check',
    Radios: 'bi-broadcast',
    Interfaces: 'bi-ethernet',
    Services: 'bi-hdd-network',
    Definitions: 'bi-clock'
  }

  let name = $state(store.loadedFrom && store.loadedFrom !== 'imported' ? store.loadedFrom : '')
  let savedNote = $state('')

  // Entries keep their document order within a domain; domains appear in the
  // order they are first seen (Unit, Radios, Interfaces, Services).
  const grouped = $derived.by(() => {
    const map = new Map<string, ChangeEntry[]>()
    for (const c of changes) {
      if (!map.has(c.section)) map.set(c.section, [])
      map.get(c.section)!.push(c)
    }
    return [...map]
  })

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
      {#each grouped as [section, items] (section)}
        <li class="flex items-start gap-3 py-3">
          <i class="bi {SECTION_ICONS[section] ?? 'bi-sliders'} mt-0.5 flex-shrink-0 text-lg text-zinc-600"></i>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-sm font-semibold text-zinc-900">{t(section)}</span>
              <span class="text-xs text-zinc-400">
                {t('{count, plural, one {# change} other {# changes}}', { count: items.length })}
              </span>
            </div>

            <ul class="mt-1">
              {#each items as c}
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
      <button
        type="button"
        class="btn-primary w-full justify-center rounded-base px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!changes.length}
        onclick={onApply}
      >
        {t('Apply to device')}
      </button>
      {#if applyError}
        <p class="mt-1 text-[11px] text-red-600">{applyError}</p>
      {/if}
    </div>
  {:else}
    <div>
      <p class="mb-1 text-xs font-medium text-zinc-700">{t('Download')}</p>
      <button type="button" class="btn w-full justify-center" onclick={download}>{t('Download JSON')}</button>
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
        <button
          type="button"
          class="btn-primary rounded-base px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!trimmed}
          onclick={save}
        >
          {t('Save')}
        </button>
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
