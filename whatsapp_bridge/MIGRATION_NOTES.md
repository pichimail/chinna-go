# WhatsApp Bridge v7 + ESM Migration Notes

**Branch:** `migration/baileys-v7-esm`

## Changes Made

- Converted entire bridge to **ESM** (`"type": "module"` in package.json)
- Updated Baileys to `^7.0.0-rc13` (latest RC as of June 2026)
- Added `lid-helper.js` with easy LID/PN resolution functions
- Updated `server.js` to prefer `.id` field from chats/contacts (v7 style)
- Integrated basic LID resolution in chat/message handling
- Added clear warnings about v7 being RC

## Important Warnings

> **Baileys v7 is still in Release Candidate (rc13)**. 
> It is **not recommended** for production use without extensive testing.

### Key v7 Changes You Should Test

1. **LID Mapping** — Many JIDs are now LIDs. Use the helpers in `lid-helper.js`.
2. **Multi-device** — Test with multiple linked devices.
3. **Auth State** — The bridge now expects `lid-mapping`, `device-list`, and `tctoken` in auth state.
4. **No more automatic ACKs** — This is intentional to avoid bans.

## How to Use the New Helpers

```js
import { getLID, getPN, resolveJid, getDisplayJid } from './lid-helper.js';

const lid = await getLID(sock, '1234567890@s.whatsapp.net');
const pn = await getPN(sock, 'lid.xxxxx@lid');
const bestJid = await resolveJid(sock, someJid);
```

## Recommended Next Steps

1. `cd whatsapp_bridge && npm install` (on the migration branch)
2. Test QR login + messaging thoroughly
3. Test with multi-device WhatsApp setups
4. Monitor for any breaking changes when v7 reaches stable
5. Consider staying on v6.7.22 (secure + stable) until v7 is fully released

## Rollback

Switch back to `main` branch if you encounter issues.
