# Write a Qwen mod

## Prerequisite

Use a Qwen Code Ink build with the Qwen Mods runtime patch and API version 1. That runtime is maintained separately. This repository contains modules and examples, with no loader implementation.

## Start from hello

Copy `examples/hello` to a new directory, change its manifest ID and choose a unique command name. IDs start with a lowercase letter and contain lowercase letters, digits or hyphens, with a maximum length of 64 characters.

```json
{
  "id": "my-mod",
  "name": "My mod",
  "apiVersion": 1,
  "entry": "./mod.mjs"
}
```

The entry must be a `.mjs` or `.js` file inside the module directory. Use `.mjs` or an ESM package configuration. Compile TypeScript or JSX before loading. Node packages can be installed alongside your entry if needed.

```js
export function register(api) {
  const { React, Text } = api.ui;

  api.command('greet', 'Change the greeting', (args) => {
    api.state.set('greeting', args || 'Hello');
    return 'Greeting updated';
  });

  api.ui.slot('abovePrompt', function Greeting({ session }) {
    return React.createElement(
      Text,
      { color: 'cyan' },
      `${api.state.get('greeting', 'Hello')} · ${session.model}`,
    );
  });
}
```

Load your directory with `/mods load /absolute/path/to/my-mod`. Edit the entry and use `/mods reload my-mod` to see changes. State survives entry reloads. Changes to imported dependencies require a restart.

## API overview

| API | Use |
| --- | --- |
| `command(name, description, handler)` | Register a slash command. Return text, a promise of text, or nothing. |
| `runCommand(name, args?)` | Submit an existing command through Qwen's dispatcher. |
| `prompt(text)` | Submit a prompt through Qwen's normal input flow. This can use tokens. |
| `on(event, callback)` | Observe `session.start`, `session.end`, `session.update`, `turn.start` or `turn.end`. |
| `hook(event, callback, options?)` | Use native Qwen function hooks, including supported prompt and tool events. |
| `session.get()` | Read the current main-session snapshot, model, cwd, usage and busy state. |
| `session.context()` | Collect local context categories, reserve and estimate status. |
| `state.get(key, fallback)` / `state.set(key, value)` | Keep transient state across entry reloads. Setting state refreshes views. |
| `store.get` / `store.set` / `store.update` | Persist JSON under the mod's ID. Use atomic `update` for read-modify-write operations. |
| `ui.slot(slot, component)` | Render in `abovePrompt`, `belowPrompt` or `footer`. Components receive `session` and `width`. |
| `ui.React`, `ui.Box`, `ui.Text`, `ui.Button` | Use the host's React and terminal components. Button takes `label` and `onPress`. |
| `ui.notify(text, level?)` | Display an info, warning or error message. |
| `ui.invalidate()` | Refresh views after changing module-owned state. |
| `timers.every(ms, callback)` | Register a managed timer with an interval of at least 100 ms. |
| `http.fetch(url, options?)` | Fetch with unload cancellation and a default timeout when no caller signal is supplied. |
| `process.run(file, args?, options?)` | Execute a program with literal arguments, without a shell. |
| `signal` | Observe module unload cancellation. |
| `experimental.config` | Access unstable Qwen internals for advanced integrations. |

The authoritative TypeScript contract lives at `packages/cli/src/mods/api.ts` in the patched Qwen Code checkout. Keep runtime API changes there rather than copying its implementation into this repository.

## Lifecycle and ownership

Use the supplied React instance. Bundling another instance can break React hooks. Slots hide while dialogs are open or the embedded shell has focus. Handle the provided width so views remain usable in narrow terminals.

Registration methods return disposers where applicable. The runtime removes registered resources on unload. `register` may also return a cleanup function for resources created directly through Node. Close those resources yourself.

The API's session snapshot and hooks describe the main session. Prompt and command submission is rejected while a subagent view, shell or dialog is active. Async work should check `api.signal` and its captured session ID or generation before updating state. Transient state survives session switches, so reset values tied to a session explicitly.

Native hooks require enabled local Qwen hooks and exclude subagent events. Their results use Qwen's native hook semantics. Safe and bare modes prevent module loading.

## Storage

Use `api.state` for values that should reset when the CLI restarts. Use `api.store` for JSON that should persist. Runtime storage lives under `$QWEN_HOME/mods/data`, or `~/.qwen/mods/data` by default, keyed by the manifest ID.

Validate saved data before using it. Keep update callbacks synchronous and free of side effects. For example:

```js
const visits = await api.store.update('visits', 0, (value) => value + 1);
```

## External services

Mods run as trusted Node.js code with user filesystem, process, environment and network access. There is no sandbox. Direct Node operations are outside Qwen's tool permission pipeline.

Use HTTP or an installed Node SDK for cloud integrations. Configure your own service credentials, such as through environment variables. The host does not automatically attach model provider credentials to HTTP requests. Never commit tokens, local settings or saved user data.

## Contribution scope

Put reusable personal mods under `plugins/` and small teaching examples under `examples/`. Add behavior tests under `test/`. Changes to the runtime, UI integration or API belong in Qwen Code.
