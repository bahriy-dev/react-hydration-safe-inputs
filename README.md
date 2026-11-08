# hydration-safe-inputs

[![CI](https://github.com/bahriy-dev/hydration-safe-inputs/actions/workflows/ci.yml/badge.svg)](https://github.com/bahriy-dev/hydration-safe-inputs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![React 18+](https://img.shields.io/badge/react-18%2B-61dafb)

**Keep what users type before React hydrates.** Drop-in `<input>`, `<textarea>` and submit button for server-rendered
React apps (Next.js, Remix, React Router).

## The bug

With server rendering, the HTML is interactive before React has loaded. On a slow phone that window can last seconds.
Two things go wrong if the user acts in it:

| User action before hydration | What happens |
| --- | --- |
| Types into a controlled input | The text stays on screen, but React keeps the initial state (`''`). Submitting computes with the empty value while the user sees their text. |
| Clicks a submit button | The browser submits the form natively, the page reloads and the typed text is gone. |

The first one is a silent correctness bug. In a hash tool, for example, the field shows `abc` while the result is the
hash of the empty string. I found it while fixing intermittent Playwright failures in
[parola-olustur](https://github.com/bahriy-dev/parola-olustur/pull/9): slow CI runners hit the window, and real users
on slow devices do too.

## Install

```bash
npm install github:bahriy-dev/hydration-safe-inputs
```

## Usage

Swap the elements. Props, refs and controlled-input behaviour stay the same.

```tsx
'use client';
import { SafeInput, SafeSubmitButton } from 'hydration-safe-inputs';

export function SearchForm() {
  const [query, setQuery] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); search(query); }}>
      <SafeInput value={query} onChange={(e) => setQuery(e.target.value)} />
      <SafeSubmitButton>Search</SafeSubmitButton>
    </form>
  );
}
```

Already have your own design-system components? Use the hooks instead:

```tsx
import { useAdoptPreHydrationValue, useHydrated } from 'hydration-safe-inputs';

const TextInput = forwardRef(function TextInput(props, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);
  useAdoptPreHydrationValue(inner); // adopt text typed before hydration
  return <input ref={inner} {...props} />;
});

function Button({ type = 'button', disabled, ...props }) {
  const hydrated = useHydrated(); // false in the server HTML, true after hydration
  return <button type={type} disabled={disabled || (type === 'submit' && !hydrated)} {...props} />;
}
```

## API

| Export | Description |
| --- | --- |
| `SafeInput`, `SafeTextArea` | Controlled fields that adopt text typed before hydration. |
| `SafeSubmitButton` | `type="submit"` button, disabled until hydrated so it can't trigger a native submit. |
| `useHydrated()` | `false` during SSR and hydration, `true` after. Built on `useSyncExternalStore`, so there's no extra render pass or effect. |
| `useAdoptPreHydrationValue(ref)` | On mount, adopts any pre-hydration value of the referenced field. |
| `adoptPreHydrationValue(el)` | The underlying function. Returns `true` if a value was replayed. |

## How it works

React renders a controlled field's value into the `value` attribute, which the DOM exposes as `defaultValue`. After
hydration, `el.value !== el.defaultValue` means the DOM was edited outside React. The library then:

1. resets the value through React's value tracker (the instance `value` setter),
2. sets the typed text through the prototype setter, which bypasses the tracker,
3. dispatches a bubbling `input` event.

React sees a real change and calls your `onChange` with the typed text. Fields the user didn't touch are left alone,
as are checkboxes, radios and file inputs.

## Tests

The tests server-render a form, type into the DOM before `hydrateRoot`, then submit:

- A plain controlled input reproduces the bug: the text is visible but the state is `''`.
- `SafeInput` and `SafeTextArea` keep the text.
- `SafeSubmitButton` is disabled in the server HTML and enabled after hydration.

```bash
npm test
```

## License

[MIT](LICENSE)
