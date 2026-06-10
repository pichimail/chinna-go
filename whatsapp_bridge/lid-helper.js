/**
 * LID / PN Resolution Helper for Baileys v7+
 * 
 * Provides easy functions to resolve between Phone Number JIDs and LIDs.
 * Uses sock.signalRepository.lidMapping internally.
 * 
 * Usage:
 *   import { resolveJid, getLID, getPN } from './lid-helper.js';
 *   const displayJid = await resolveJid(sock, someJid);
 */

export async function getLID(sock, pnJid) {
  if (!sock?.signalRepository?.lidMapping) return null;
  try {
    return await sock.signalRepository.lidMapping.getLIDForPN(pnJid);
  } catch (e) {
    return null;
  }
}

export async function getPN(sock, lidJid) {
  if (!sock?.signalRepository?.lidMapping) return null;
  try {
    return sock.signalRepository.lidMapping.getPNForLID(lidJid);
  } catch (e) {
    return null;
  }
}

/**
 * Resolves a JID to the best displayable form.
 * Prefers LID if available, falls back to original.
 * In v7+, many events use LIDs as primary ID.
 */
export async function resolveJid(sock, jid) {
  if (!jid) return jid;
  
  // Already a LID
  if (jid.includes('@lid')) return jid;
  
  const lid = await getLID(sock, jid);
  return lid || jid;
}

/**
 * Gets the best identifier for display (prefers phone number when possible)
 */
export async function getDisplayJid(sock, jid) {
  if (!jid) return jid;
  
  if (jid.includes('@lid')) {
    const pn = await getPN(sock, jid);
    return pn || jid;
  }
  return jid;
}

/**
 * Normalizes chat/contact objects to prefer .id field (v7 style)
 */
export function normalizeChat(chat) {
  if (!chat) return chat;
  return {
    ...chat,
    jid: chat.id || chat.jid || chat.remoteJid,  // v7 uses .id
    id: chat.id || chat.jid || chat.remoteJid,
  };
}
