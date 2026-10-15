# ThUnselect

<img src="icons/icon.svg" width="64" height="64" alt="ThUnselect icon">

A small Thunderbird extension by **Nikita Denin**.

Adds **“Do not select next message after removal/archiving”** to its own
settings. Enabled by default. After selected messages are deleted, archived,
or moved out of the message list, the list is deselected and the preview is
cleared, without first opening the next message.

## Install

1. Download or build `dist/thunselect-1.2.0.xpi`.
2. In Thunderbird, open **Add-ons and Themes → Extensions**.
3. Open the gear menu, choose **Install Add-on From File…**, and select the XPI.
4. Accept the permission prompt.
5. Open ThUnselect’s **Preferences / Options** (the wrench button on its card)
   to change the checkbox.

Changes apply immediately to existing and new Mail tabs/windows. The setting
is saved in this Thunderbird profile. Unchecking the box or disabling/removing
the extension restores normal selection behavior.

## Scope and permissions

- Works on the message list in Mail tabs, including multi-message selections.
- Right-click removal of an unselected message preserves Thunderbird’s existing
  selection behavior.
- Standalone message tabs/windows and the separate Search Messages dialog retain
  their normal behavior.
- Does not change deletion, archive destinations, message contents, or read-state
  preferences, and does not make network requests.
- Uses an **Experiment API**, because the standard MailExtension API cannot
  intercept auto-selection before the next message opens. Thunderbird therefore
  requests **full access**. The hook uses private Thunderbird internals, so
  Thunderbird updates or other extensions that replace the same hook may require
  a compatibility update.
- Declares Thunderbird 140–158 compatibility (`strict_max_version` is required
  for Experiments on ATN); runtime verification is against the installed
  Thunderbird 158.0, not every release.
- The extension-owned preference
  `extensions.thunselect.preventNextSelection` remains after uninstall, but has
  no effect without the extension.

## License

Code and documentation are dedicated to the public domain under the
[Unlicense](LICENSE). The icon, `icons/icon.svg`, is separately
dedicated under [CC0 1.0 Universal](icons/LICENSE).

## Build

No dependencies or build tools beyond `zip`:

```sh
scripts/build.sh            # -> dist/thunselect-<version>.xpi
```

The XPI includes both license notices alongside the runtime files.

## Releases

Pushing a `v*` tag runs [the release workflow](.github/workflows/release.yml):
it checks the tag matches `manifest.json`, runs the unit tests, builds the XPI
on GitHub, and publishes a Release named after the tag with the XPI attached
and generated release notes. No extra secrets are needed.

Bump `manifest.json` and commit it before tagging, for example:

```sh
git tag -a v1.2.0 -m "ThUnselect 1.2.0"
git push origin HEAD v1.2.0
```

The tagged commit must include the workflow for automatic releases. To release
an existing tag manually, use **Actions → Release → Run workflow**, select the
default branch, and enter the tag. The manual run builds that tag, not the latest
branch. This does not publish to addons.thunderbird.net.

## Check

```sh
node --test tests/selection.test.cjs
```

For live checks, use a separate Thunderbird profile under `/tmp` with synthetic
Local Folders messages, never a real mail account. Check deletion, permanent
deletion, archiving, multi-selection, the final message, the checkbox off/on,
new tabs/windows, and disabling the add-on.
