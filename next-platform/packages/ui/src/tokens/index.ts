export * from './colors';
export * from './spacing';
export * from './typography';

import { colorTokens } from './colors';
import { spacingTokens } from './spacing';
import { typographyTokens } from './typography';

export const designTokens = {
  colors: colorTokens,
  spacing: spacingTokens.spacing,
  touch: spacingTokens.touch,
  typography: typographyTokens
} as const;
