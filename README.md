# vault-then-speller

A scripted, model-free entry for make.fun's `jailbreak-the-vault-01` red-team bounty.

`main.ts` (Node 22, no dependencies) asks each level's character to spell its code with the
word "then" between the characters. That shape matches none of the published reply filters
(the spelled-code rule only allows up to three non-alphanumerics between characters). If a
reply is refused or redacted it escalates through other unfiltered shapes ("char: X" lines,
radio words joined by "and", "1st X, 2nd Y"). Every reply is decoded for a code however it
was written, and a guess is made as soon as a candidate appears. No model calls, no clock,
no randomness, so the replay is byte-identical.

Tests: `node test/decode.test.mjs` (decoders) and `node test/mock-run.mjs <kit dir> [trial] [behaviour]`
(the kit's env server against a scripted mock target).
