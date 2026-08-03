<script>
  import { store, doc_export, config_save, saved_names } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'

  let { changes, connected = false, applyError = null, onApply } = $props()

  let name = $state(store.loadedFrom && store.loadedFrom !== 'imported' ? store.loadedFrom : '')
  let savedNote = $state('')

  // Entries keep their document order within a domain; domains appear in the
  // order they are first seen (Unit, Radios, Interfaces, Services).
  const grouped = $derived.by(() => {
    const map = new Map()
    for (const c of changes) {
      if (!map.has(c.section)) map.set(c.section, [])
      map.get(c.section).push(c)
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
    <div class="rounded-base border border-zinc-200 px-8 py-6">
      {#each grouped as [section, items] (section)}
        <div class="mb-6 last:mb-0">
          <h3 class="changes-topic-title">{t(section)}</h3>
          <ul class="mt-4">
            {#each items as c}
              <li class="flex items-center gap-2 py-1 text-sm text-zinc-900">
                <span class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"></span>
                {c.label}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
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
