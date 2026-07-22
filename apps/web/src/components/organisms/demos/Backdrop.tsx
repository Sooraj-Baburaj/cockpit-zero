/**
 * Premium wallpaper treatments that sit behind the floating demo launcher —
 * pure CSS gradient compositions in the site palette (warm neutrals + a
 * restrained Ion glow; The Retired Ember Rule keeps orange off this surface).
 * Each variant has a light and a dim rendition, switched by the site theme
 * (`.czd-bg-*` classes in globals.css). The grain layer reuses `--cz-noise`
 * so any visible gradient obeys The Grain Rule.
 */
export type BackdropVariant = 'dawn' | 'haze' | 'ion';

export function DemoBackdrop({ variant }: { variant: BackdropVariant }) {
  return (
    <div aria-hidden className={`absolute inset-0 czd-bg-${variant}`}>
      <div className="czd-grain absolute inset-0" />
    </div>
  );
}
