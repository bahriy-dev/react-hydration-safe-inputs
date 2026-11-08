'use client';

import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type RefObject,
  type TextareaHTMLAttributes,
} from 'react';

type TextField = HTMLInputElement | HTMLTextAreaElement;

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'hidden']);
const subscribe = () => () => {};

/**
 * `false` while the server-rendered HTML is on screen without React, `true` once the page is hydrated.
 * Safe to call during server rendering.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * If the user typed into `el` before React hydrated it, replay that text as a real `input` event so React's
 * `onChange` adopts it. Returns `true` when a value was replayed.
 *
 * React keeps a controlled field's initial state through hydration, so without this the field shows what the user
 * typed while the component state (and anything computed from it) still holds the initial value.
 */
export function adoptPreHydrationValue(el: TextField): boolean {
  if (el instanceof HTMLInputElement && NON_TEXT_INPUTS.has(el.type)) return false;
  // `defaultValue` mirrors the `value` React rendered, so a difference means the DOM was edited outside React.
  if (el.value === el.defaultValue) return false;
  const typed = el.value;
  // The instance `value` setter is React's value tracker: resetting through it makes the replayed event a change.
  el.value = el.defaultValue;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, typed);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** Run {@link adoptPreHydrationValue} on the referenced field once it mounts. */
export function useAdoptPreHydrationValue(ref: RefObject<TextField | null>): void {
  useEffect(() => {
    if (ref.current) adoptPreHydrationValue(ref.current);
  }, [ref]);
}

/** An `<input>` that keeps text typed before hydration. Use it like a normal controlled input. */
export const SafeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SafeInput(props, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);
  useAdoptPreHydrationValue(inner);
  return createElement('input', { ...props, ref: inner });
});

/** A `<textarea>` that keeps text typed before hydration. Use it like a normal controlled textarea. */
export const SafeTextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function SafeTextArea(props, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);
  useAdoptPreHydrationValue(inner);
  return createElement('textarea', { ...props, ref: inner });
});

/**
 * A submit button that stays disabled until the page is hydrated. Before hydration a click would submit the form
 * natively (a full page load that wipes what was typed) instead of running your `onSubmit`.
 */
export const SafeSubmitButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>>(
  function SafeSubmitButton({ disabled, ...props }, ref) {
    const hydrated = useHydrated();
    return createElement('button', { ...props, ref, type: 'submit', disabled: disabled || !hydrated });
  },
);
