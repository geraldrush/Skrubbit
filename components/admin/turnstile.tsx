"use client";

import * as React from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

/**
 * Renders the Turnstile widget and reports its token to the parent form.
 *
 * Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is absent. The key is
 * inlined at build time, so a build made before the widget existed has no key
 * to use — and an admin login that showed an unsolvable challenge would be a
 * lockout. `lib/turnstile.ts` skips verification in the same situation, so the
 * two halves switch on together.
 *
 * Rendered explicitly rather than by the script's auto-scan: `onSuccess` has
 * to reach React state, and the implicit mode has nowhere to put it.
 */
export function Turnstile({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  // Held in a ref so re-renders don't tear down and re-render the widget,
  // which would make the visitor solve it twice.
  const callback = React.useRef(onToken);
  callback.current = onToken;

  React.useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;

    function render() {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        action: "turnstile-spin-v1",
        callback: (token: string) => callback.current(token),
        // A token is good for 300s. Clearing it on expiry means a form left
        // open is refused with "complete the challenge" rather than failing
        // for a reason the visitor cannot see.
        "expired-callback": () => callback.current(""),
        "error-callback": () => callback.current(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`
      );
      if (existing) {
        existing.addEventListener("load", render);
      } else {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.addEventListener("load", render);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}

/** Whether a challenge will actually be shown, so forms can require a token. */
export const turnstileEnabled = Boolean(SITE_KEY);
