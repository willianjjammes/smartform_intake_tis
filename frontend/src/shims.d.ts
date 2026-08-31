// Ambient module declarations para imports side-effect que TypeScript não conhece
declare module '@formkit/themes/genesis'
declare module '*.svg?raw' {
  const content: string
  export default content
}
