<script lang="ts">
  import BrandMark from './BrandMark.svelte'
  import Button from './Button.svelte'
  import Spinner from './Spinner.svelte'
  import { t } from '../i18n.svelte.js'
  import { request as ws_request, login as ws_login } from '../connection.svelte.js'
  import { wizard_defaults, wizard_steps, step_error, wizard_document, MAX_SSID, MAX_KEY } from '../wizard.svelte.js'
  import type { WizardStep, WizardSecurity } from '../wizard.svelte.js'
  import type { UconfigDocument } from '../types/uconfig'

  interface Props {
    capabilities?: unknown
    onDone: (doc: UconfigDocument) => void
  }

  let { capabilities = null, onDone }: Props = $props()

  const data = $state(wizard_defaults())
  let index = $state(0)
  let phase = $state<'form' | 'applying' | 'done'>('form')
  let touched = $state(false)
  // The document the wizard produced, handed to the caller on Continue.
  let pending = $state<UconfigDocument | null>(null)
  let applyError = $state<string | null>(null)
  let continuing = $state(false)

  const steps = $derived(wizard_steps(data.mode))
  const step = $derived<WizardStep>(steps[Math.min(index, steps.length - 1)])
  const error = $derived(step_error(step, data))
  const last = $derived(index === steps.length - 1)

  function next() {
    if (error) {
      touched = true
      return
    }
    touched = false
    if (!last) {
      index += 1
      return
    }
    apply()
  }

  function back() {
    touched = false
    if (index > 0) index -= 1
  }

  async function apply() {
    phase = 'applying'
    applyError = null
    // Both inputs are snapshotted: the document goes to doc_adopt, which
    // structuredClones it, and a reactive proxy cannot be cloned.
    const doc = wizard_document($state.snapshot(data), $state.snapshot(capabilities))
    try {
      // Password first. A device in setup mode is already authenticated, so
      // setting it cannot invalidate the session part-way through.
      await ws_request('change-password', { password: data.password })
      await ws_request('config-apply', { config: doc, includes: {} })
      pending = doc
      phase = 'done'
    } catch (e) {
      applyError = e instanceof Error ? e.message : String(e)
      phase = 'form'
    }
  }

  // Applying the config makes the device configured, which ends the unauthenticated
  // grace the wizard ran under. Logging in with the password just set is what
  // carries the session into the app.
  async function continue_to_app() {
    if (!pending || continuing) return
    continuing = true
    applyError = null
    try {
      await ws_login(data.password)
      onDone(pending)
    } catch (e) {
      applyError = e instanceof Error ? e.message : String(e)
    } finally {
      continuing = false
    }
  }

  const SECURITY: WizardSecurity[] = ['maximum', 'compatibility']

  function security_hint(v: WizardSecurity): string {
    return v === 'maximum'
      ? 'WPA3 only. The strongest option, but devices older than about 2019 cannot join.'
      : 'WPA2 and WPA3 together. Choose this if an older device cannot join.'
  }
</script>

{#snippet flip(value: WizardSecurity, set: (v: WizardSecurity) => void)}
  <span class="flex overflow-hidden rounded-base border border-zinc-300">
    {#each SECURITY as option, i (option)}
      <button
        type="button"
        class="flex-1 px-2 py-1.5 text-xs transition {i > 0 ? 'border-l border-zinc-300' : ''} {value === option
          ? 'bg-accent font-medium text-accent-ink'
          : 'bg-surface text-zinc-700'}"
        onclick={() => set(option)}
      >
        {option === 'maximum' ? t('Maximum') : t('Compatibility')}
      </button>
    {/each}
  </span>
{/snippet}

<div class="flex flex-1 items-center justify-center overflow-y-auto p-4">
  <div class="w-full max-w-sm rounded-base border border-zinc-200 bg-surface p-8 shadow-flat-md">
    <div class="flex items-center justify-center gap-2.5">
      <BrandMark size={32} />
      <h1 class="text-xl font-semibold tracking-tight">{t('uConfig')}</h1>
    </div>

    {#if phase === 'form'}
      <div class="mt-4 flex items-center justify-center gap-1.5">
        {#each steps as _, i (i)}
          <span
            class="h-[7px] w-[7px] rounded-full {i < index ? 'bg-accent-dark' : i === index ? 'bg-accent' : 'bg-zinc-300'}"
          ></span>
        {/each}
      </div>
      <p class="mt-2 text-center text-xs text-zinc-500">
        {t('Step {n} of {total}', { n: index + 1, total: steps.length })}
      </p>
    {/if}

    <!-- Reserved height keeps the card from resizing as steps change, the same
         reason the login card fixes its body. -->
    <div class="mt-5 flex min-h-[15rem] flex-col">
      {#if phase === 'applying'}
        <div class="flex flex-1 flex-col items-center justify-center gap-3">
          <Spinner class="h-6 w-6 text-zinc-400" />
          <p class="text-center text-sm text-zinc-500">{t('Writing the configuration to the device…')}</p>
        </div>
      {:else if phase === 'done'}
        <div class="flex flex-1 flex-col items-center justify-center gap-3">
          <svg class="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p class="text-sm text-zinc-700">{t('Your device is set up.')}</p>
          <p class="text-center text-[11px] text-zinc-500">
            {t('If you changed the Wi-Fi name, reconnect using the new one.')}
          </p>
          <div class="mt-2 w-full">
            <Button variant="primary" full disabled={continuing} onclick={continue_to_app}>{t('Continue')}</Button>
          </div>
          {#if applyError}
            <p class="mt-1 text-center text-[11px] text-red-600">{applyError}</p>
          {/if}
        </div>
      {:else if step === 'mode'}
        <p class="mb-4 text-center text-sm text-zinc-500">{t('How should this device be used?')}</p>
        <div class="flex flex-col gap-2.5">
          <button
            type="button"
            class="flex items-start gap-3 rounded-base border p-3 text-left transition {data.mode === 'router'
              ? 'border-accent bg-nav-active'
              : 'border-zinc-300 bg-surface'}"
            onclick={() => (data.mode = 'router')}
          >
            <i class="bi bi-router mt-0.5 text-lg text-accent"></i>
            <span>
              <span class="block text-sm font-semibold text-zinc-900">{t('Router')}</span>
              <span class="block text-xs text-zinc-500">
                {t('Provides internet to the network. WAN uplink, LAN and Wi-Fi behind it.')}
              </span>
            </span>
          </button>
          <button
            type="button"
            class="flex items-start gap-3 rounded-base border p-3 text-left transition {data.mode === 'ap'
              ? 'border-accent bg-nav-active'
              : 'border-zinc-300 bg-surface'}"
            onclick={() => (data.mode = 'ap')}
          >
            <i class="bi bi-broadcast mt-0.5 text-lg text-accent"></i>
            <span>
              <span class="block text-sm font-semibold text-zinc-900">{t('Access point')}</span>
              <span class="block text-xs text-zinc-500">
                {t('Extends a network that already has a router. All ports bridged.')}
              </span>
            </span>
          </button>
        </div>
      {:else if step === 'password'}
        <p class="mb-4 text-center text-sm text-zinc-500">{t('Choose the password for this device.')}</p>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Password')}</span>
          <input class="input" type="password" autocomplete="new-password" bind:value={data.password} />
          <small class="text-[11px] leading-snug text-zinc-500">
            {t('Used for this web interface and for SSH.')}
          </small>
        </label>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Repeat password')}</span>
          <input class="input" type="password" autocomplete="new-password" bind:value={data.passwordRepeat} />
          <small class="text-[11px] leading-snug text-zinc-500">{t('Both entries must match.')}</small>
        </label>
      {:else if step === 'identity'}
        <p class="mb-4 text-center text-sm text-zinc-500">{t('What should this device be called?')}</p>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Hostname')}</span>
          <input class="input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore bind:value={data.hostname} />
          <small class="text-[11px] leading-snug text-zinc-500">
            {t('How the device appears on the network. Letters, digits and hyphens.')}
          </small>
        </label>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Timezone')}</span>
          <input class="input bg-zinc-50 text-zinc-500" type="text" value={data.timezone} readonly />
          <small class="text-[11px] leading-snug text-zinc-500">
            {t('Read from this computer. Change it later under Configure › Unit.')}
          </small>
        </label>
      {:else if step === 'wifi'}
        <p class="mb-4 text-center text-sm text-zinc-500">{t('Your main Wi-Fi network.')}</p>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Network name')}</span>
          <input class="input" type="text" maxlength={MAX_SSID} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore bind:value={data.ssid} />
          <small class="text-[11px] leading-snug text-zinc-500">{t('The name people see when choosing a network.')}</small>
        </label>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Password')}</span>
          <input class="input" type="password" maxlength={MAX_KEY} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore bind:value={data.key} />
          <small class="text-[11px] leading-snug text-zinc-500">
            {t('At least 8 characters. Shared with everyone who joins.')}
          </small>
        </label>
        <label class="mb-3 flex flex-col gap-1">
          <span class="text-xs font-medium text-zinc-700">{t('Security')}</span>
          {@render flip(data.security, (v) => (data.security = v))}
          <small class="text-[11px] leading-snug text-zinc-500">{t(security_hint(data.security))}</small>
        </label>
      {:else if step === 'guest'}
        <div class="mb-3 flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-zinc-900">{t('Guest Wi-Fi')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={data.guestOn}
            aria-label={t('Guest Wi-Fi')}
            onclick={() => (data.guestOn = !data.guestOn)}
            class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition {data.guestOn
              ? 'bg-accent'
              : 'bg-zinc-300'}"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition {data.guestOn
                ? 'translate-x-4'
                : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
        {#if data.guestOn}
          <label class="mb-3 flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-700">{t('Network name')}</span>
            <input class="input" type="text" maxlength={MAX_SSID} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore bind:value={data.guestSsid} />
            <small class="text-[11px] leading-snug text-zinc-500">{t('Shown separately from your own network.')}</small>
          </label>
          <label class="mb-3 flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-700">{t('Password')}</span>
            <input class="input" type="password" maxlength={MAX_KEY} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore bind:value={data.guestKey} />
            <small class="text-[11px] leading-snug text-zinc-500">
              {t('Safe to share. Guests cannot reach your own devices.')}
            </small>
          </label>
          <label class="mb-3 flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-700">{t('Security')}</span>
            {@render flip(data.guestSecurity, (v) => (data.guestSecurity = v))}
            <small class="text-[11px] leading-snug text-zinc-500">{t(security_hint(data.guestSecurity))}</small>
          </label>
        {:else}
          <p class="text-[11px] leading-snug text-zinc-500">
            {t('A separate network for visitors, with no access to your own devices.')}
          </p>
        {/if}
      {:else if step === 'review'}
        <p class="mb-3 text-center text-sm text-zinc-500">{t('Review before applying.')}</p>
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('Device')}</p>
        <dl class="mb-3">
          <div class="flex justify-between gap-4 border-b border-zinc-200 py-1 text-xs">
            <dt class="text-zinc-500">{t('Mode')}</dt>
            <dd class="text-zinc-800">{data.mode === 'router' ? t('Router') : t('Access point')}</dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-zinc-200 py-1 text-xs">
            <dt class="text-zinc-500">{t('Hostname')}</dt>
            <dd class="text-zinc-800">{data.hostname}</dd>
          </div>
          <div class="flex justify-between gap-4 py-1 text-xs">
            <dt class="text-zinc-500">{t('Timezone')}</dt>
            <dd class="text-zinc-800">{data.timezone}</dd>
          </div>
        </dl>
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('Wi-Fi')}</p>
        <dl>
          <div class="flex justify-between gap-4 border-b border-zinc-200 py-1 text-xs">
            <dt class="text-zinc-500">{t('Main')}</dt>
            <dd class="text-zinc-800">{data.ssid}</dd>
          </div>
          <div class="flex justify-between gap-4 {data.guestOn ? 'border-b border-zinc-200' : ''} py-1 text-xs">
            <dt class="text-zinc-500">{t('Security')}</dt>
            <dd class="text-zinc-800">{data.security === 'maximum' ? t('Maximum') : t('Compatibility')}</dd>
          </div>
          {#if data.guestOn}
            <div class="flex justify-between gap-4 py-1 text-xs">
              <dt class="text-zinc-500">{t('Guest')}</dt>
              <dd class="text-zinc-800">{data.guestSsid}</dd>
            </div>
          {/if}
        </dl>
      {/if}

      {#if phase === 'form'}
        {#if touched && error}
          <p class="mt-1 text-[11px] text-red-600">{t(error)}</p>
        {/if}
        {#if applyError}
          <p class="mt-1 text-[11px] text-red-600">{applyError}</p>
        {/if}
        <div class="mt-auto flex gap-2 pt-4">
          <Button full disabled={index === 0} onclick={back}>{t('Back')}</Button>
          <Button variant="primary" full onclick={next}>{last ? t('Apply') : t('Next')}</Button>
        </div>
      {/if}
    </div>
  </div>
</div>
