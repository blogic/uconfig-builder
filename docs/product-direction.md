# Two apps, one codebase

Decisions taken 2026-08-06 about what the two build flavours are for, and how a
config declares which one owns it.

Sources:
- src/lib/flavour.ts — the build-time flags
- vite.config.js — how the flavours are defined
- src/lib/components/ServicePage.svelte — first feature to differ by flavour
- ../uconfig/schema/ — the document schema the two share

## The split

One codebase produces two applications with different audiences.

**The offline editor** is a raw structural editor: "I know what I am doing".
It exposes the document as the schema describes it, with no opinion about
whether the result is a sensible router. It is the escape hatch, and the tool
of record for anything the live app will not represent.

**The live app** manages a device. It is a product surface rather than an
editor: the vocabulary is what a network does, such as guest access, IoT
isolation and uplink, rather than interfaces, VLAN ids and port lists. It offers
a bounded
set of choices and is free to refuse a document it does not model, because the
offline editor is always available for that case.

This is why the flavours exist as genuine builds rather than a runtime flag:
`__IS_DEVICE__` and `__IS_EDITOR__` are replaced with literals so Rollup drops
the unreachable half. Neither app ships the other's code.

## Why a declared mode, not detection

The live app cannot present a document it has no model for. The question is
how it recognises one.

Inferring intent from structure does not work: two documents with identical
interfaces may mean entirely different things, and a heuristic that is right
most of the time fails exactly where a user is least able to diagnose it.

Instead the config carries a section, written by a setup wizard, declaring the
use case it was built for: a predefined profile such as router or access point,
or raw. That is authoritative. The live app reads it and either presents
the matching profile or declines and points at the offline editor.

**Version the marker from the start.** It is a contract between the webui, the
CLI and anything reading state, and the meaning of a profile name will drift
across releases. Adding a version afterwards is materially harder than carrying
one from the first commit.

## The CLI honours it too

A marker only the webui respects is advisory, and drift becomes routine: the
webui restricts, the CLI does not, and the document leaves its declared model
without anything noticing.

So the CLI gains the same awareness, refusing actions outside a profile and
offering the live app's vocabulary when a profile is in force. The two stop
being different views of one file and become one product surface with two front
ends.

## What is deliberately not defended

Someone with root can edit the JSON by hand and put webui, config and state out
of step. That is not a threat we try to prevent: defending a file against its
owner is unwinnable, and attempting it badly costs a great deal of complexity
for no real safety. Root has many other ways to break the device.

The obligation is narrower and achievable: do not corrupt a document we did
write, and do not silently mangle one we did not.

## Consequences already visible

The service enable/disable toggle is the first feature that exists in one
flavour and not the other. In the editor a service is declared by its block
being present, and the user decides. On a device the services are the ones the
device runs, so the toggle would be a lie.

The same asymmetry is why the live app can drop the raw service pages entirely:
in a profile-driven model a service is an attribute of a use case, not a page
someone navigates to. The 802.1X page rendering "No configuration available for
this service" is a symptom of applying the editor's model to the live app.
