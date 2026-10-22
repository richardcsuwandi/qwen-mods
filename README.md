# Qwen Mods

[![test](https://github.com/richardcsuwandi/qwen-mods/actions/workflows/test.yml/badge.svg)](https://github.com/richardcsuwandi/qwen-mods/actions/workflows/test.yml)

Small terminal add-ons for [Qwen Code](https://github.com/QwenLM/qwen-code). A deadline countdown in the footer, a usage bar above the prompt, and a stacked breakdown of what fills your context window. Each one is an ordinary module on the Qwen Mods API, so you can use them as they are, change them, or start your own from the hello example.

They are adapted from [Claude Mods](https://github.com/richardcsuwandi/claude-mods).

> **Status.** These modules run on the Qwen Mods runtime, API version 1, in the interactive Ink CLI. Stock Qwen Code and Claude Code do not include it. The runtime ships here as a patch you apply to Qwen Code, see [runtime/](runtime). It is not submitted upstream yet.

## What they look like

These are sketches with made-up numbers, laid out by the formatting code in each module. Category names come from Qwen at runtime. Colors change with state and layouts shrink on narrow terminals.

```text
 context-bar    ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒
                ~84.0k/200.0k (42%)  █ System prompt 9.0k  █ Tools 14.0k  █ Messages 61.0k  ░ Free 96.0k  ▒ Reserve 20.0k

 usage-bar      ctx █████░░░░░░░ 42%  84.0k/200.0k  in 83.0k · out 5.0k  est. $0.31

 footer         ◷ Paper submission 4d 3h 12m  +2
```

When the context passes 85 percent the usage bar adds a Compress button, and it turns red at 90 percent.

## At a glance

| Mod | Command | What it does |
|-----|---------|--------------|
| [Deadlines](plugins/deadlines) | `/ddl` | Live countdown to your next deadline, saved across restarts, with AoE and IANA time zones |
| [Usage bar](plugins/usage-bar) | `/usage-bar` | Context fill, session tokens and estimated cost, with a one-time warning and a Compress button |
| [Context bar](plugins/context-bar) | `/context-bar` | Stacked breakdown of context categories, free space and reserved compaction capacity |
| [Hello](examples/hello) | `/hello` | The smallest useful mod, to copy from |

## Get started

Build a patched Qwen Code first. [runtime/README.md](runtime/README.md) has the exact commands, which are a checkout of one upstream commit, `git apply` of [the patch](runtime/qwen-mods-runtime.patch), and a build.

Then clone this repository and start the patched CLI from inside it.

```sh
git clone https://github.com/richardcsuwandi/qwen-mods.git
cd qwen-mods
QWEN_TUI_RENDERER=ink node /path/to/qwen-code/dist/cli.js
```

Then load the mods:

```text
/mods load plugins/deadlines
/mods load plugins/usage-bar
/mods load plugins/context-bar
```

Paths resolve from the CLI's current working directory. In another project, pass the absolute path to each mod directory. Quoted paths containing spaces are supported.

To load a mod automatically in future sessions, use `enable` instead of `load`:

```text
/mods enable plugins/deadlines
/mods list
/mods reload deadlines
/mods unload deadlines
/mods disable deadlines
```

`unload` stops a mod for the current CLI instance. `disable` also removes its startup entry. `reload` refreshes the entry and retains transient API state. Restart after editing imported helpers, because Node caches dependencies.

No npm dependencies or build step are needed for these mods. Qwen supplies React and Ink.

## Mod reference

### Deadlines

A live countdown in the footer, with deadlines saved across restarts.

```text
/ddl add Paper submission 2027-01-28 aoe
/ddl add Team meeting 2027-07-15 12:00 America/New_York
/ddl add Camera ready 2027-02-10 18:00 UTC+08:00
/ddl
/ddl rm Team meeting
```

Names can contain spaces. Adding an existing name updates it, ignoring capitalization. A date without a time means 23:59. Omitting the zone uses your local zone.

Supported zones include AoE, IANA names, fixed UTC offsets and common abbreviations. `pt`, `mt`, `ct` and `et` follow daylight saving. `pst` and `est` are fixed offsets. `cst` means China Standard Time when the local zone is Shanghai, Taipei, Chongqing or Harbin, and US Central Standard Time elsewhere. Use an IANA name or numeric offset to be explicit. Ambiguous or nonexistent daylight saving times are rejected.

The footer shows the next deadline and refreshes every 15 seconds. Red means less than one day, yellow means less than one week, and green means later. `/ddl` includes passed deadlines. Dates are displayed in the local zone. Atomic store updates preserve additions from concurrent CLI sessions.

Source: [plugins/deadlines](plugins/deadlines). Its manifest ID is `deadlines`, and its command is `/ddl`.

### Usage bar

Context occupancy, session input/output tokens, and estimated cost when model pricing is configured.

```text
/usage-bar
/usage-bar on
/usage-bar off
```

The bar is visible when loaded. It turns yellow at 70% and red at 90%. At 85%, the enabled mod posts one warning and offers a Compress button while idle. The warning rearms below 75% or for a new session. `/compress` is the keyboard alternative and performs Qwen's normal model-backed compression.

This displays session usage, not provider account quota. Partial cost estimates are labeled. Visibility and warning state survive entry reloads and reset when the runtime restarts.

Source: [plugins/usage-bar](plugins/usage-bar).

### Context bar

A stacked breakdown of context categories, free space and reserved compaction capacity.

```text
/context-bar
/context-bar on
/context-bar off
/context-bar refresh
```

The bar is visible when loaded and refreshes after turns and relevant session changes while idle. `~` marks a locally estimated total. Cached tokens overlap existing categories and are not counted again. Category names accompany the colors, and the legend wraps to the terminal width.

The collector uses local session data and makes no extra model request. Native `/context` remains available for the full report.

Source: [plugins/context-bar](plugins/context-bar).

## Build your own mod

Start with [examples/hello](examples/hello):

```text
/mods load examples/hello
/hello Hello Qwen
/mods reload hello
```

Each module contains `qwen-mod.json` and a JavaScript entry exporting `register(api)`. The API supports commands, React/Ink UI slots, session events, native Qwen hooks, state, persistent JSON storage, timers, HTTP and subprocesses. A mod can connect to external services using credentials you configure for that service.

See [the author guide](docs/AUTHORING.md) and [contributing](CONTRIBUTING.md). Authors can create independent mods without changing Qwen's source.

## Test

Requires Node.js 22 or newer:

```sh
npm test
```

The tests use Node's built-in test runner and a fake host. They make no network or model requests. The modules were also checked against the patched Ink runtime on macOS, including loading, reload, persistence, cleanup and narrow layouts. Windows and Linux remain unvalidated.

## Relationship to Claude Mods

This repository is the Qwen-compatible counterpart to [richardcsuwandi/claude-mods](https://github.com/richardcsuwandi/claude-mods), inspired by [Claude Code Mods](https://claude.dev/blog/getting-started-with-claude-code-mods/). It ports the deadline, usage bar and context bar ideas to Qwen's API. Claude-specific manifests and API calls are not interchangeable with Qwen modules.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
