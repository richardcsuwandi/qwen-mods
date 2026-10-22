# Changelog

## 0.1.1

- Ship the Qwen Mods runtime as `runtime/qwen-mods-runtime.patch` with build instructions, so the mods can run without a private checkout. It applies to Qwen Code commit 2a6879e, passes its 236 related tests, and builds from a clean clone.
- Add manifest tests that check ids, entries, `register` exports and the no-dependency rule for every module.
- Run the test suite in GitHub Actions on Node.js 22.
- Rewrite the README opening with a status note, layout sketches and a mod table.
- Add package metadata.

## 0.1.0

- First release with the deadlines, usage bar and context bar mods and the hello starter.
