import type { ReactNode } from 'react';

/** In the app there is no web shell: screens fill the phone. (See WebShell.web.tsx.) */
export function WebShell({ children }: { children: ReactNode }) {
  return children;
}
