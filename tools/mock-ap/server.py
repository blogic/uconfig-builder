#!/usr/bin/env python3
"""A stand-in for the ucoord websocket server on an access point.

Speaks JSON-RPC 2.0 over ws://<host>/uconfig, the endpoint a singleton device
serves. The methods that act on the device itself are top level and take no
address: a device managing itself has nothing to address.

The venue-scoped ucoord API still exists for coordinating several devices, and
is served here too so the uCoord page has something to read.

New RPCs are prototyped here and ported to
../uconfig/modules/ucoord/usr/share/ucode/ucoord/uwsd-handler.uc once settled.
Device readings come from fixtures captured from a real GL-MT6000; the
configuration is live, so applying an edit and reading it back round-trips.

    npm run mock            ws://localhost:8080/uconfig
"""

import asyncio
import json
import shutil
import sys
import time
from pathlib import Path

import websockets
from websockets.asyncio.server import serve

try:
    import jsonschema
except ImportError:
    sys.exit('mock-ap needs jsonschema to validate configs: pip install jsonschema')

HERE = Path(__file__).parent
FACTORY = HERE / 'factory.json'
FIXTURES = HERE / 'fixtures.json'
# The schema the app ships and the device validates against, so the mock rejects
# exactly what a device would.
SCHEMA = HERE.parent.parent / 'src/lib/data/schema.json'
STATE = HERE / 'state'
STATE_CONFIG = STATE / 'config.json'
STATE_INCLUDES = STATE / 'includes'
STATE_PASSWORD = STATE / 'password'

# --no-modules omits the list from the login reply, so the client's "device
# said nothing" path can be exercised.
NO_MODULES = '--no-modules' in sys.argv

# --includes serves the envelope carrying the main config plus its include
# fragments. Without it the reply is the bare document a pre-includes client
# expects, so both shapes can be tested against one build.
INCLUDES = '--includes' in sys.argv

HOST = '0.0.0.0'
PORT = 8080
SUBPROTOCOL = 'uconfig'

# The client waits for this before offering the password prompt; the device
# sends it 200ms after the socket opens.
LOGIN_PROMPT_DELAY = 0.2

ERROR_PARSE = -32700
ERROR_INVALID_REQUEST = -32600
ERROR_METHOD_NOT_FOUND = -32601
ERROR_INVALID_PARAMS = -32602
ERROR_INTERNAL = -32603
ERROR_LOGIN_REQUIRED = -32001
ERROR_INVALID_PASSWORD = -32000

# Only the venue-scoped calls carry an address. The device's own methods are
# top level, since a singleton has nothing to address.
ADDRESSED = {'peer-config-get', 'peer-config-apply', 'peer-info'}

# What the setup wizard needs before the device has a password. Everything else
# stays shut: an unconfigured device is not an open device. `ping` is here
# because the client's keepalive would otherwise tear the socket down part-way
# through the wizard.
WIZARD_METHODS = {'ping', 'login', 'capabilities', 'change-password', 'config-apply'}

# Which sockets each network holds, standing in for /tmp/uconfig/ports.<network>
# on a device. uconfig writes one of those files per interface when it applies a
# config, and `ports` reads it to narrow the reply.
PORTS_BY_NETWORK = {
    'wan': ['eth1'],
    'lan': ['lan1', 'lan2', 'lan3', 'lan4', 'lan5']
}

fixtures = json.loads(FIXTURES.read_text())
_schema = json.loads(SCHEMA.read_text())
# Draft-07 by declaration, and it depends on those semantics: `interfaces` is
# `{"$ref": ..., "additionalProperties": false}`, where draft-07 ignores the
# siblings of a $ref. Under 2020-12 the sibling applies against a schema with no
# `properties`, and every interface is rejected as an unexpected property.
SCHEMA_VALIDATOR = jsonschema.validators.validator_for(_schema)(_schema)


def log(*parts):
    print('[mock-ap]', *parts, flush=True)



def config_read():
    """The applied config if one exists, otherwise what the AP ships with.

    The shipped baseline carries no uuid -- a device stamps one the first time
    it applies it, so `config-get` never returns a document without one. Stamped
    here for the same reason: a client that round-trips what it was given must
    get something the config methods will accept back.
    """
    if STATE_CONFIG.exists():
        return json.loads(STATE_CONFIG.read_text())
    return {**json.loads(FACTORY.read_text()), 'uuid': int(time.time())}


def config_write(doc):
    # `uconfig-apply` re-stamps the uuid on every apply unless it is given `-u`,
    # and the web UI never passes it. The stored config therefore carries the
    # time it was applied, not whatever the client sent.
    doc = {**doc, 'uuid': int(time.time())}
    STATE.mkdir(exist_ok=True)
    STATE_CONFIG.write_text(json.dumps(doc, indent='\t') + '\n')


def deep_merge(target, source):
    """Merge source over target, recursing into objects. The fragment wins.

    Mirrors deep_merge in uconfig's includes.uc and in src/lib/includes.ts.
    """
    out = dict(target)
    for k, v in source.items():
        cur = out.get(k)
        if isinstance(v, dict) and isinstance(cur, dict):
            out[k] = deep_merge(cur, v)
        else:
            out[k] = v
    return out


def at_path(value, path):
    """Walk a dotted path into a fragment, or return it whole for a bare name."""
    if path is None:
        return value
    for part in path.split('.'):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def include_resolve(value, fragments):
    """Resolve every `include` reference in a document, depth first.

    uconfig merges the fragments in and strips both the references and the
    top-level alias map before the schema ever sees the document, so validating
    has to happen against the resolved form: `interfaces.guest.vlan` is an empty
    object until its overlay lands, and would fail on its own.
    """
    if isinstance(value, list):
        return [include_resolve(v, fragments) for v in value]
    if not isinstance(value, dict):
        return value

    out = {k: include_resolve(v, fragments) for k, v in value.items() if k != 'include'}

    refs = value.get('include')
    if isinstance(refs, list):
        for raw in refs:
            if not isinstance(raw, str):
                continue
            source, _, path = raw.partition('.')
            snippet = at_path(fragments.get(source), path or None)
            if isinstance(snippet, dict):
                out = deep_merge(out, snippet)
    return out


def config_validate(doc, fragments):
    """First schema error in the resolved document, or None.

    The device runs `uconfig-apply -t` here. Doing nothing -- which is what this
    used to do -- meant the mock accepted documents no device would, and the
    first sign of it was a bare "config test failed" on real hardware.
    """
    resolved = include_resolve(doc, fragments)
    resolved.pop('includes', None)

    # Strict mode rejects a document with no integer uuid, and this is not a
    # schema rule -- the schema has `uuid` as an optional integer. `uconfig-apply`
    # stamps one itself, but only under `if (!opts.no_apply)`, and `-t` sets
    # no_apply, so the test that gates every apply never does. Checked here in
    # the same words the device uses.
    if not isinstance(resolved.get('uuid'), int) or isinstance(resolved.get('uuid'), bool):
        return 'Configuration must contain a valid UUID'

    errors = sorted(SCHEMA_VALIDATOR.iter_errors(resolved), key=lambda e: list(e.absolute_path))
    if not errors:
        return None

    err = errors[0]
    where = '/'.join(str(p) for p in err.absolute_path) or '(document root)'
    return f'{where}: {err.message}'


def includes_read():
    """Every stored fragment, keyed by include name."""
    if not STATE_INCLUDES.exists():
        return {}
    return {p.stem: json.loads(p.read_text()) for p in sorted(STATE_INCLUDES.glob('*.json'))}


def includes_write(mapping):
    """Persist the complete intended set of fragments.

    A name absent from `mapping` is deleted: config-apply carries everything the
    client knows about, so omission is how a deletion is expressed.

    The uuid is assigned here rather than by the client. It orders ucoord's peer
    sync, so it has to move only when the content actually moves; stamping every
    apply would make every peer re-fetch every fragment.
    """
    stored = includes_read()
    STATE_INCLUDES.mkdir(parents=True, exist_ok=True)

    for name, content in mapping.items():
        body = {k: v for k, v in content.items() if k != 'uuid'}
        previous = stored.get(name, {})
        unchanged = body == {k: v for k, v in previous.items() if k != 'uuid'}
        uuid = previous.get('uuid') if unchanged and 'uuid' in previous else int(time.time())
        (STATE_INCLUDES / f'{name}.json').write_text(
            json.dumps({'uuid': uuid, **body}, indent='\t') + '\n'
        )

    for name in stored:
        if name not in mapping:
            (STATE_INCLUDES / f'{name}.json').unlink()
            log('include deleted:', name)


def password_read():
    """The password the wizard set, or None on a device that has none yet.

    Stored under state/ so a factory reset drops it: an unconfigured device has
    no password at all, and the wizard is what gives it one.
    """
    if not STATE_PASSWORD.exists():
        return None
    return STATE_PASSWORD.read_text().rstrip('\n')


def password_write(password):
    STATE.mkdir(exist_ok=True)
    STATE_PASSWORD.write_text(password + '\n')


def needs_setup():
    """A config with no top-level `webui` object has never been through setup."""
    return 'webui' not in config_read()


def factory_reset():
    """Discard applied state so the first-boot flow can be replayed."""
    if STATE.exists():
        shutil.rmtree(STATE)


class Session:
    def __init__(self, ws):
        self.ws = ws
        self.logged_in = False

    async def send(self, payload):
        await self.ws.send(json.dumps(payload))

    async def reply(self, rid, result):
        await self.send({'jsonrpc': '2.0', 'id': rid, 'result': result})

    async def fail(self, rid, code, message, data=None):
        err = {'code': code, 'message': message}
        if data is not None:
            err['data'] = data
        await self.send({'jsonrpc': '2.0', 'id': rid, 'error': err})

    async def notify(self, method, params=None):
        msg = {'jsonrpc': '2.0', 'method': method}
        if params is not None:
            msg['params'] = params
        await self.send(msg)

    # --- methods ------------------------------------------------------------

    async def m_login(self, rid, params):
        if not isinstance(params, dict) or 'password' not in params:
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        # A device with no password has not been set up, and reaches the app
        # through the wizard rather than this method.
        stored = password_read()
        if stored is None or params['password'] != stored:
            return await self.fail(rid, ERROR_INVALID_PASSWORD, 'Invalid password')
        self.logged_in = True
        # The optional packages the device has installed. The client uses this
        # to hide services the device could not run; a service with no sentinel
        # ships with the base system and is never listed here.
        result = {'success': True}
        if not NO_MODULES:
            result['modules'] = fixtures.get('modules', [])
        await self.reply(rid, result)

    async def m_logout(self, rid, _params):
        self.logged_in = False
        await self.reply(rid, {'success': True})

    async def m_ping(self, rid, _params):
        await self.reply(rid, {'success': True})

    async def m_change_password(self, rid, params):
        if not isinstance(params, dict) or not params.get('password'):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        # A real device stores the /etc/shadow hash. The mock keeps the plain
        # string: it has no shadow file, and login has to compare against
        # whatever the wizard sent.
        password_write(params['password'])
        log('password set')
        await self.reply(rid, {'success': True})

    async def m_status(self, rid, _params):
        await self.reply(rid, fixtures['status'])

    async def m_capabilities(self, rid, _params):
        await self.reply(rid, fixtures['capabilities'])

    async def m_info(self, rid, _params):
        await self.reply(rid, fixtures['info'])

    async def m_modules(self, rid, _params):
        # Login carries the same list; a call of its own means a session can
        # refresh it without reconnecting.
        await self.reply(rid, fixtures.get('modules', []))

    async def m_devices(self, rid, _params):
        await self.reply(rid, fixtures['devices'])

    async def m_traffic(self, rid, _params):
        await self.reply(rid, fixtures['traffic'])

    async def m_radios(self, rid, _params):
        await self.reply(rid, fixtures['radios'])

    async def m_ports(self, rid, params):
        # The ubus method narrows to the ports one network holds, reading
        # /tmp/uconfig/ports.<network>; the fixture stands in for that file.
        ports = fixtures['ports']
        network = (params or {}).get('network')
        if network:
            want = PORTS_BY_NETWORK.get(network, [])
            ports = {k: v for k, v in ports.items() if v['netdev'] in want}
        await self.reply(rid, ports)

    async def m_network(self, rid, _params):
        await self.reply(rid, fixtures['network'])

    async def m_event_log(self, rid, _params):
        # The device returns the ring buffer in slot order, so once it has
        # wrapped the array starts mid-way through. The fixture is stored
        # rotated for that reason: a client that forgets to sort by `time`
        # should look wrong here rather than on the device.
        await self.reply(rid, fixtures['event-log'])

    async def m_memory(self, rid, _params):
        # `system` is read from /proc/meminfo when the call arrives; the process
        # lists are resampled hourly, so the two halves are not the same age.
        await self.reply(rid, fixtures['memory'])

    async def m_syslog(self, rid, _params):
        # The whole buffer, as the device returns it: procd bounds it by
        # system.log_size rather than by anything the caller asks for.
        await self.reply(rid, fixtures['syslog'])

    async def m_dmesg(self, rid, _params):
        # Kernel entries carry no `id` or `source`, and the device has already
        # converted their monotonic stamps to epoch milliseconds.
        await self.reply(rid, fixtures['dmesg'])

    async def m_state(self, rid, _params):
        # The real daemon has no `state` object registered, and the UI is
        # written to tolerate that; failing here keeps the mock honest.
        await self.fail(rid, ERROR_INTERNAL, 'ubus error: 3')

    async def m_config_get(self, rid, _params):
        # The envelope carries the main document and its fragments together, so
        # a client sees the whole config state in one call. Without --includes
        # the reply is the bare document, which is what a pre-includes client
        # expects.
        if not INCLUDES:
            return await self.reply(rid, config_read())
        await self.reply(rid, {'config': config_read(), 'includes': includes_read()})

    async def m_config_test(self, rid, params):
        doc = (params or {}).get('config')
        if not isinstance(doc, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        detail = config_validate(doc, self.fragments_for(params))
        if detail:
            return await self.fail(rid, ERROR_INTERNAL, 'config test failed', {'detail': detail})
        await self.reply(rid, {'ok': True})

    def fragments_for(self, params):
        """The fragments to resolve against: what the client just sent, over
        what is already stored. The device stores before it renders, so a client
        that edits an overlay and applies in one call must validate against the
        new value rather than the old one.
        """
        sent = (params or {}).get('includes')
        stored = includes_read()
        return {**stored, **sent} if isinstance(sent, dict) else stored

    async def m_config_apply(self, rid, params):
        doc = (params or {}).get('config')
        if not isinstance(doc, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        # Absent rather than empty means a client that predates the envelope, so
        # the stored fragments are left alone rather than deleted wholesale.
        fragments = (params or {}).get('includes')
        if fragments is not None and not isinstance(fragments, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        # The device tests before it applies, and refuses to apply what fails.
        detail = config_validate(doc, self.fragments_for(params))
        if detail:
            return await self.fail(rid, ERROR_INTERNAL, 'config test failed', {'detail': detail})
        config_write(doc)
        if fragments is not None:
            includes_write(fragments)
            log('config applied with', len(fragments), 'include(s)')
        else:
            log('config applied ->', STATE_CONFIG.relative_to(HERE.parent.parent))
        await self.reply(rid, {'ok': True, 'apply': True})

    async def m_factory_reset(self, rid, _params):
        # Not a ucoord method on a real device; the mock needs a way back to
        # first boot so the setup flow can be exercised more than once.
        factory_reset()
        log('factory reset; serving', FACTORY.name, 'again')
        await self.reply(rid, {'ok': True})

    async def m_reboot(self, rid, params):
        log('reboot requested (no-op)')
        await self.reply(rid, {'ok': True})

    async def m_sysupgrade(self, rid, params):
        if not isinstance(params, dict) or not params.get('url'):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        log('sysupgrade requested (no-op):', params['url'])
        await self.reply(rid, {'ok': True, 'upgrade': True})

    # --- venue-scoped (ucoord) -------------------------------------------
    # Kept for coordinating other devices. The singleton API above is what the
    # UI uses for the device it is connected to.

    async def m_peer_info(self, rid, params):
        peer = params.get('peer')
        if peer not in fixtures['status'].get('venues', {}).get(params.get('venue'), {}):
            return await self.fail(rid, ERROR_INTERNAL, 'unknown peer')
        await self.reply(rid, fixtures['info'])

    async def m_peer_config_get(self, rid, _params):
        await self.m_config_get(rid, _params)

    async def m_peer_config_apply(self, rid, params):
        await self.m_config_apply(rid, params)

    async def m_reload(self, rid, _params):
        await self.reply(rid, {'venues': list(fixtures['status'].get('venues', {}))})

    async def m_include(self, rid, params):
        if not isinstance(params, dict) or not params.get('action'):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        if params['action'] == 'list':
            return await self.reply(rid, {})
        await self.reply(rid, {'ok': True})

    def handlers(self):
        return {
            # `ping` needs a session, matching the device. A rejected ping is
            # still traffic on the socket, so the keepalive does its job on the
            # login screen either way; `login` is the only method a configured
            # device answers before it has one.
            'ping': (self.m_ping, True),
            'login': (self.m_login, False),
            'logout': (self.m_logout, True),
            'change-password': (self.m_change_password, True),
            'list': (self.m_status, True),
            'status': (self.m_status, True),
            'info': (self.m_info, True),
            'system-info': (self.m_info, True),
            'state': (self.m_state, True),
            'capabilities': (self.m_capabilities, True),
            'modules': (self.m_modules, True),
            'devices': (self.m_devices, True),
            'traffic': (self.m_traffic, True),
            'radios': (self.m_radios, True),
            'ports': (self.m_ports, True),
            'network': (self.m_network, True),
            'event-log': (self.m_event_log, True),
            'memory': (self.m_memory, True),
            'syslog': (self.m_syslog, True),
            'dmesg': (self.m_dmesg, True),
            'config-get': (self.m_config_get, True),
            'config-test': (self.m_config_test, True),
            'config-apply': (self.m_config_apply, True),
            'factory-reset': (self.m_factory_reset, True),
            'reboot': (self.m_reboot, True),
            'sysupgrade': (self.m_sysupgrade, True),
            'peer-info': (self.m_peer_info, True),
            'peer-config-get': (self.m_peer_config_get, True),
            'peer-config-apply': (self.m_peer_config_apply, True),
            'reload': (self.m_reload, True),
            'include': (self.m_include, True),
        }

    async def dispatch(self, raw):
        try:
            req = json.loads(raw)
        except json.JSONDecodeError:
            return await self.fail(None, ERROR_PARSE, 'Parse error')

        if not isinstance(req, dict) or req.get('jsonrpc') != '2.0' or not req.get('method'):
            return await self.fail(req.get('id') if isinstance(req, dict) else None,
                                   ERROR_INVALID_REQUEST, 'Invalid request')

        rid = req.get('id')
        method = req['method']
        params = req.get('params') or {}

        entry = self.handlers().get(method)
        if not entry:
            return await self.fail(rid, ERROR_METHOD_NOT_FOUND, 'Method not found')

        handler, needs_auth = entry
        if needs_auth and not self.logged_in:
            # A configured device asks for a password and answers nothing else
            # until it gets one. An unconfigured device has no password to ask
            # for, so the wizard runs instead -- but only the calls the wizard
            # makes are open, and the error says so rather than saying
            # `login-required`, which would prompt for a password that does not
            # exist yet.
            if not needs_setup():
                return await self.fail(rid, ERROR_LOGIN_REQUIRED, 'login-required')
            if method not in WIZARD_METHODS:
                return await self.fail(rid, ERROR_INTERNAL,
                                       'Setup wizard must be completed first')

        if method in ADDRESSED and (not params.get('venue') or not params.get('peer')):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')

        if method not in ('ping',):
            log(method)
        await handler(rid, params)


async def connection(ws):
    if SUBPROTOCOL not in (ws.request.headers.get('Sec-WebSocket-Protocol') or ''):
        await ws.close(1003, 'Unsupported protocol requested')
        return

    session = Session(ws)
    log('client connected')
    await asyncio.sleep(LOGIN_PROMPT_DELAY)
    # An unconfigured device asks for setup rather than a password: there is no
    # password to give until the wizard sets one. Access is granted by
    # `authorised()` per call, not latched here, so it lapses as soon as the
    # wizard's config lands.
    if needs_setup():
        log('no webui object -> setup-required')
        await session.notify('setup-required')
    else:
        await session.notify('login-required')

    try:
        async for raw in ws:
            await session.dispatch(raw)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        log('client disconnected')


async def main():
    state = 'applied config' if STATE_CONFIG.exists() else 'factory config'
    stored = password_read()
    log(f'serving {state}; ' + (f'password is {stored!r}' if stored else 'no password set, run the wizard'))
    if INCLUDES:
        log(f'include envelope enabled; {len(includes_read())} fragment(s) stored')
    log(f'listening on ws://localhost:{PORT}/uconfig')
    async with serve(connection, HOST, PORT, subprotocols=[SUBPROTOCOL]):
        await asyncio.Future()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
