declare const __ADM_RELEASE_MODE__: 'candidate' | 'lab';
declare const __ADM_VERSION__: string;
declare const __ADM_ORIGIN__: string;
declare const __ADM_RELEASE_SELECTOR__: string;
declare module '@admin-entry' {
  import type { ComponentType } from 'react';
  export const AdminEntry: ComponentType;
}
