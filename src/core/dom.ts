/**
 * dom.ts — tiny DOM helpers for building the game UI.
 * Safe knobs: none (pure helpers).
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function div(cls: string, ...children: (Node | string | null | undefined)[]): HTMLDivElement {
  return el('div', { class: cls }, ...children);
}

export function button(
  cls: string,
  ...children: (Node | string | null | undefined | (() => void))[]
): HTMLButtonElement {
  const b = el('button', { class: cls, type: 'button' });
  let onClick: (() => void) | null = null;
  for (const c of children) {
    if (typeof c === 'function') onClick = c;
    else if (c != null) b.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function show(node: HTMLElement, visible = true): void {
  node.classList.toggle('hidden', !visible);
}

/** Download a string as a file. */
export function download(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Two-step confirm: first click arms, second click inside timeout fires. */
export function confirmButton(cls: string, label: string, confirmLabel: string, onConfirm: () => void): HTMLButtonElement {
  let armed = false;
  let timer = 0;
  const b = button(cls, label, () => {
    if (armed) {
      armed = false;
      b.textContent = label;
      onConfirm();
      return;
    }
    armed = true;
    b.textContent = confirmLabel;
    b.classList.add('armed');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      armed = false;
      b.textContent = label;
      b.classList.remove('armed');
    }, 3000);
  });
  return b;
}
