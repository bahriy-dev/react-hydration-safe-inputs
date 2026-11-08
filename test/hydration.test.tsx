// @vitest-environment jsdom
import { act, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafeInput, SafeSubmitButton, SafeTextArea, adoptPreHydrationValue } from '../src/index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Field = 'plain' | 'safe-input' | 'safe-textarea';

/** A tiny "tool": type text, submit, see the result computed from React state. */
function Tool({ field }: { field: Field }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const props = { 'aria-label': 'text', value: text, onChange: (e: { target: { value: string } }) => setText(e.target.value) };
  return (
    <form onSubmit={(e) => { e.preventDefault(); setResult(text.toUpperCase()); }}>
      {field === 'plain' && <input {...props} />}
      {field === 'safe-input' && <SafeInput {...props} />}
      {field === 'safe-textarea' && <SafeTextArea {...props} />}
      <SafeSubmitButton>Run</SafeSubmitButton>
      {result !== null && <output>{result}</output>}
    </form>
  );
}

let container: HTMLElement;
afterEach(() => container?.remove());

/** Server-render, let the "user" type before React loads, then hydrate. */
async function typeBeforeHydration(field: Field, typed: string) {
  container = document.createElement('div');
  container.innerHTML = renderToString(<Tool field={field} />);
  document.body.append(container);
  const el = container.querySelector<HTMLInputElement | HTMLTextAreaElement>('[aria-label=text]')!;
  el.value = typed;
  await act(async () => { hydrateRoot(container, <Tool field={field} />); });
  return el;
}

async function submit() {
  await act(async () => { container.querySelector('form')!.requestSubmit(); });
  return container.querySelector('output')?.textContent;
}

describe('text typed before hydration', () => {
  it('is lost by a plain controlled input (the bug)', async () => {
    const el = await typeBeforeHydration('plain', 'abc');
    expect(el.value).toBe('abc'); // still on screen…
    expect(await submit()).toBe(''); // …but the component computed with ''
  });

  it('is kept by SafeInput', async () => {
    await typeBeforeHydration('safe-input', 'abc');
    expect(await submit()).toBe('ABC');
  });

  it('is kept by SafeTextArea', async () => {
    await typeBeforeHydration('safe-textarea', 'line 1\nline 2');
    expect(await submit()).toBe('LINE 1\nLINE 2');
  });
});

describe('SafeSubmitButton', () => {
  it('is disabled in the server HTML and enabled after hydration', async () => {
    const html = renderToString(<Tool field="safe-input" />);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    await typeBeforeHydration('safe-input', '');
    expect(container.querySelector('button')!.disabled).toBe(false);
  });
});

describe('adoptPreHydrationValue', () => {
  it('does nothing when the value was not edited', () => {
    const input = document.createElement('input');
    input.defaultValue = 'same';
    const listener = vi.fn();
    input.addEventListener('input', listener);
    expect(adoptPreHydrationValue(input)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores checkboxes and file inputs', () => {
    for (const type of ['checkbox', 'file']) {
      const input = document.createElement('input');
      input.type = type;
      expect(adoptPreHydrationValue(input)).toBe(false);
    }
  });
});
