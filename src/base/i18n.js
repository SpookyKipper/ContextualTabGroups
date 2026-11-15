// Fills [data-i18n] elements from _locales. chrome.i18n follows the browser UI language (en fallback).
// textContent only: translations are never parsed as HTML.
document.documentElement.lang = chrome.i18n.getMessage("langCode") || "en";
document.querySelectorAll("[data-i18n]").forEach((el) => {
  const msg = chrome.i18n.getMessage(el.dataset.i18n);
  if (msg) el.textContent = msg;
});
