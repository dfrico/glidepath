// One non-blocking notice at the bottom of the page, for errors the user can
// act on. Replaces alert() for failures and gives launch traffic a place to go.

import { el } from './dom.js';

export const ISSUES_URL = 'https://github.com/dfrico/glidepath/issues/new';

let box = null;
let timer = null;

export function showError(message, detail) {
  show('error', message, detail);
}

export function showInfo(message) {
  show('info', message);
}

export function hide() {
  if (box) box.remove();
  box = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

function show(kind, message, detail) {
  hide();
  box = el('div', { class: `notice notice-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, [
    el('div', { class: 'notice-body' }, [
      el('div', { class: 'notice-msg', text: message }),
      detail ? el('div', { class: 'notice-detail muted', text: detail }) : null,
    ]),
    kind === 'error'
      ? el('a', { class: 'notice-link', href: issueUrl(message, detail), target: '_blank', rel: 'noopener', text: 'Report a bug' })
      : null,
    el('button', { class: 'btn ghost small', type: 'button', onClick: hide, text: 'Dismiss' }),
  ]);
  document.body.appendChild(box);
  if (kind === 'info') timer = setTimeout(hide, 6000);
}

// Pre-fills the issue title. The body stays empty on purpose: the user
// decides what to share, and their data never leaves the browser.
function issueUrl(message, detail) {
  const title = ['Bug:', message, detail].filter(Boolean).join(' ').slice(0, 120);
  return ISSUES_URL + '?title=' + encodeURIComponent(title);
}

// Last line of defence: anything that escapes the app's own handling.
export function installGlobalHandlers() {
  window.addEventListener('error', (e) => {
    const msg = e.error && e.error.message ? e.error.message : e.message;
    showError('Something went wrong in the app. Your data is unchanged.', msg || undefined);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const msg = r && r.message ? r.message : (r == null ? undefined : String(r));
    showError('Something went wrong in the app. Your data is unchanged.', msg);
  });
}
