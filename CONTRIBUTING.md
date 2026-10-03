# Contributing

This repository contains Qwen-compatible mods. Runtime, loader and API changes belong in Qwen Code.

1. Start from `examples/hello` and read [the author guide](docs/AUTHORING.md).
2. Give the module a unique manifest ID and command names.
3. Use only the public API unless an experimental dependency is clearly documented.
4. Respect `api.signal`, clean up resources you create directly, and handle narrow terminal widths.
5. Document commands, storage, required credentials and any model requests.
6. Add behavior tests and run `npm test` with Node.js 22 or newer.
7. Check the module in the patched Ink CLI and describe the OS and runtime used in your PR.

Keep dependencies minimal. Do not commit credentials, personal settings, recordings or saved mod data. Preserve attribution for code adapted from other projects.
