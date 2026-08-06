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
from pathlib import Path

import websockets
from websockets.asyncio.server import serve

HERE = Path(__file__).parent
FACTORY = HERE / 'factory.json'
FIXTURES = HERE / 'fixtures.json'
STATE = HERE / 'state'
STATE_CONFIG = STATE / 'config.json'

# --no-modules omits the list from the login reply, so the client's "device
# said nothing" path can be exercised.
NO_MODULES = '--no-modules' in sys.argv

HOST = '0.0.0.0'
PORT = 8080
PASSWORD = 'a'
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

fixtures = json.loads(FIXTURES.read_text())


def log(*parts):
    print('[mock-ap]', *parts, flush=True)


def config_read():
    """The applied config if one exists, otherwise what the AP ships with."""
    if STATE_CONFIG.exists():
        return json.loads(STATE_CONFIG.read_text())
    return json.loads(FACTORY.read_text())


def config_write(doc):
    STATE.mkdir(exist_ok=True)
    STATE_CONFIG.write_text(json.dumps(doc, indent='\t') + '\n')


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
        self.authenticated = False

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
        if params['password'] != PASSWORD:
            return await self.fail(rid, ERROR_INVALID_PASSWORD, 'Invalid password')
        self.authenticated = True
        # The optional packages the device has installed. The client uses this
        # to hide services the device could not run; a service with no sentinel
        # ships with the base system and is never listed here.
        result = {'success': True}
        if not NO_MODULES:
            result['modules'] = fixtures.get('modules', [])
        await self.reply(rid, result)

    async def m_logout(self, rid, _params):
        self.authenticated = False
        await self.reply(rid, {'success': True})

    async def m_ping(self, rid, _params):
        await self.reply(rid, {'success': True})

    async def m_change_password(self, rid, params):
        if not isinstance(params, dict) or not params.get('password'):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
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

    async def m_state(self, rid, _params):
        # The real daemon has no `state` object registered, and the UI is
        # written to tolerate that; failing here keeps the mock honest.
        await self.fail(rid, ERROR_INTERNAL, 'ubus error: 3')

    async def m_config_get(self, rid, _params):
        await self.reply(rid, config_read())

    async def m_config_test(self, rid, params):
        doc = (params or {}).get('config')
        if not isinstance(doc, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        await self.reply(rid, {'ok': True})

    async def m_config_apply(self, rid, params):
        doc = (params or {}).get('config')
        if not isinstance(doc, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        config_write(doc)
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
        await self.reply(rid, config_read())

    async def m_peer_config_apply(self, rid, params):
        doc = (params or {}).get('config')
        if not isinstance(doc, dict):
            return await self.fail(rid, ERROR_INVALID_PARAMS, 'Invalid params')
        config_write(doc)
        await self.reply(rid, {'ok': True, 'apply': True})

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
            'ping': (self.m_ping, False),
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
        if needs_auth and not self.authenticated:
            return await self.fail(rid, ERROR_LOGIN_REQUIRED, 'login-required')

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
    # password to give until the wizard sets one.
    if needs_setup():
        session.authenticated = True
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
    log(f'serving {state}; password is {PASSWORD!r}')
    log(f'listening on ws://localhost:{PORT}/uconfig')
    async with serve(connection, HOST, PORT, subprotocols=[SUBPROTOCOL]):
        await asyncio.Future()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
