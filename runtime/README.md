# Qwen Mods runtime patch

`qwen-mods-runtime.patch` adds the Qwen Mods runtime to [Qwen Code](https://github.com/QwenLM/qwen-code). It is what the modules in this repository run on. It is not part of Qwen Code yet, so you apply it yourself and build your own copy.

The patch targets Qwen Code commit `2a6879e648e15e9d105a4f5f9768a972b3517cf6`. It adds the loader, the API, the Ink host, the `/mods` command and the docs, and it touches six existing UI files to mount the footer and prompt slots.

## Build a patched Qwen Code

You need Node.js 22 or newer and pnpm.

```sh
git clone https://github.com/QwenLM/qwen-code.git
cd qwen-code
git checkout 2a6879e648e15e9d105a4f5f9768a972b3517cf6
git apply /path/to/qwen-mods/runtime/qwen-mods-runtime.patch
pnpm install --frozen-lockfile
npm run build
npm run bundle
```

Run the interactive Ink CLI from the `qwen-mods` directory so that the relative paths in the README resolve.

```sh
cd /path/to/qwen-mods
QWEN_TUI_RENDERER=ink node /path/to/qwen-code/dist/cli.js
```

Then `/mods load plugins/deadlines` and the other commands in the main README will work. Run `/mods list` to see what is loaded.

## Newer Qwen Code versions

Check the patch against a newer commit with `git apply --check`. If it no longer applies, the conflicts will be in the six UI files, which are small. Use the commit above as the known-good base.

## What it does and does not do

- Mods are trusted Node.js code with your account's access. There is no sandbox.
- `--safe-mode` and `--bare` prevent mod loading.
- The user guide in `docs/users/features/qwen-mods.md` and the design note in `docs/design/qwen-mods.md` come with the patch.
- The patch includes its own tests. Run `npx vitest run src/mods` from `packages/cli` after applying it.

## Status

The patch is not submitted to Qwen Code. If it is merged upstream, this directory will be replaced by a note and the mods will run on stock Qwen Code.
