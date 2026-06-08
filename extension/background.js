/* Chinna Companion — background service worker */
'use strict';

// Open side panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Keyboard command: new chat
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'new-chat') {
    chrome.runtime.sendMessage({ type: 'NEW_CHAT' }).catch(() => {});
  }
});

// Context menu: "Ask Chinna about this"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'chinna-ask',
    title: 'Ask Chinna about "%s"',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'chinna-page',
    title: 'Summarize this page with Chinna',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  const text = info.menuItemId === 'chinna-ask'
    ? 'Explain: ' + info.selectionText
    : 'Summarize this page';
  // Give panel time to mount
  setTimeout(() => chrome.runtime.sendMessage({ type: 'PREFILL', text }).catch(() => {}), 400);
});

// Relay: allow sidepanel to request tab capture etc.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'PING') { reply({ ok: true }); return true; }
});
