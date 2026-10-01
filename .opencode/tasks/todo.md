# Safe OpenCode artifact copier tasks

- [x] Source discovery and safe automatic merge: copy only adapted artifacts into direct target folders; preserve supporting files and permissions. Verified with copier CLI tests.
- [x] Conflict decisions: replace/skip per artifact, bulk decisions scoped to type, one decision per skill, and no writes before all answers. Verified with stdin-driven integration tests.
- [x] Failure handling: reject unsafe paths, cancel safely, atomically write, and restore originals after write failure. Verified with validation and injected-failure tests.
- [x] Documentation and CI: documented usage and merge semantics; integrated copier tests into existing Ubuntu, macOS, and Windows jobs. Focused tests, full Node tests, artifact-path/reference/mirror validation, and a real-pack smoke test passed locally on macOS.
