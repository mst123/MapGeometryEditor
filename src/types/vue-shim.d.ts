// Fix TypeScript "cannot find module '*.vue'" in <script lang="ts">
// when the editor/tsserver isn't picking up Vue SFC type generation.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

