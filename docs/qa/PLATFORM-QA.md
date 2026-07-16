# Platform parity QA (B2) — manual checklists

The B2 **code** work (Linux app/file search, `.desktop` launch, Wayland hotkey
fallback, secrets degradation) is implemented and unit-tested, but it was
written on macOS — this doc is the on-device validation that closes B2. Run the
Linux list on at least one X11 and one Wayland distro (e.g. Ubuntu LTS +
Fedora), and the Windows list on Windows 11 (plus 10 if we still target it).

## Linux

### App search (`infra/app-scanner.ts` → `scanLinuxApps`)

- [ ] Typing an app name lists it (entries from `/usr/share/applications`).
- [ ] A user-local app (`~/.local/share/applications`) appears; a user override
      of a system id wins; a `Hidden=true` override removes the app.
- [ ] Flatpak apps appear (`/var/lib/flatpak/exports/...` and user flatpaks).
- [ ] Snap apps appear (`/var/lib/snapd/desktop/applications`).
- [ ] `NoDisplay=true` helpers (e.g. `org.gnome.Terminal.Preferences`) do NOT appear.
- [ ] Running an app row launches the app (via `gio launch`); on a distro
      without `gio`, `gtk-launch` picks it up. It must never open the
      `.desktop` file in a text editor.

### File search (`infra/file-search.ts` → plocate)

- [ ] With `plocate` installed: file results appear under Files, capped, and a
      freshly indexed file is findable after `updatedb`.
- [ ] Without `plocate`: no Files section, no error, config + app results
      unaffected (degrades to `[]`).

### Hotkey

- [ ] X11: the configured hotkey (default Ctrl+J) summons the bar.
- [ ] Wayland (GNOME + KDE): Console → General shows the Wayland notice with
      the `cockpitzero --toggle` instruction.
- [ ] Binding a system shortcut to `cockpitzero --toggle` toggles the bar
      (second-instance path; requires a packaged build — the lock is
      `app.isPackaged`-gated).
- [ ] `cockpitzero --toggle` with the app not running starts it AND shows the bar.

### Secrets (safeStorage / libsecret)

- [ ] With a keyring (GNOME Keyring / KWallet unlocked): saving a BYOP key
      works; key survives restart; AI connects.
- [ ] Without libsecret / locked keyring: every SecretField shows the
      "secure storage isn't available" warning on mount with Save disabled;
      nothing is written to `~/.config/CockpitZero/secrets/vault.json`;
      the rest of the app (launcher, actions, workflows) is fully usable.

### General

- [ ] Frameless launcher renders correctly (transparency/glass) on GNOME + KDE,
      X11 + Wayland.
- [ ] AppImage launches on a clean VM (no dev deps).

## Windows

- [ ] **SystemIndex reliability**: file results appear for indexed locations;
      searches on an unindexed/disabled-index machine degrade to no Files
      section without delaying the bar.
- [ ] **`.lnk` icons**: Start-Menu app rows show their real icons
      (`app.getFileIcon` on the `.lnk`), not blanks or generic icons.
- [ ] **NSIS install/uninstall**: install to default + custom dir; uninstall
      removes the app but leaves `%APPDATA%\CockpitZero` (config) — decide and
      document either way; reinstall over an existing install works.
- [ ] **Hotkey conflicts**: default Ctrl+J vs common apps; changing the hotkey
      in Console re-registers live; a conflicting chord is rejected inline by
      the recorder.
- [ ] **Frameless behaviors**: launcher has no shadow artifacts, doesn't appear
      in Alt-Tab, hides on blur; Console window minimizes/maximizes/snaps.
- [ ] **Per-monitor DPI**: bar renders crisp and centered on mixed-DPI
      multi-monitor setups; moving between monitors doesn't mis-scale.
- [ ] **Launch at login** toggle works (registry entry added/removed).
- [ ] Secrets vault round-trips via DPAPI (save key, restart, AI still connected).
