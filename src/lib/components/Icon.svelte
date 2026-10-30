<script lang="ts" module>
  /** the line drawings on the open book's buttons, each on a 24px grid */
  const PATHS = {
    back: 'M19 12H5M11 6l-6 6 6 6',
    bin: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    cancel: 'M6 6l12 12M18 6L6 18',
    cloth: 'M4 6c3-2 5 2 8 0s5 2 8 0v12c-3 2-5-2-8 0s-5-2-8 0z',
    editions: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    pencil: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
    search: 'M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0zM20 20l-4.5-4.5',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    turn: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
    upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  };

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  type Props = {
    name: IconName;
    size?: number;
  };

  let { name, size = 18 }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex: none;
  }
</style>
