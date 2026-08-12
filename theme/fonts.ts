// Central font-family names so screens never hardcode them. Inter is loaded
// at the app root via expo-font; Menlo ships with iOS for the mono stream.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  mono: 'Menlo',
} as const;
