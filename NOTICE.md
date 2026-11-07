# Notice

Mordheim Campaign Manager has two kinds of content in this repository, and
they are covered differently.

## 1. The app: covered by the licence

The source code, database migrations, scripts, design, data structures and
the way the app works are Copyright (c) 2026 Evin Wijninga. They are licensed
under the **PolyForm Strict License 1.0.0** (see [`LICENSE`](LICENSE)).

In short, and the licence text is what counts: you may read the code, and use
it for personal and other noncommercial purposes. You may **not** copy it into
another project, redistribute it, or publish a modified version or a new work
based on it, without written permission.

**Contributions.** As an extra permission on top of the licence, you may fork
this repository on GitHub and change your fork **only to prepare a
contribution** (a pull request or a patch) back to this project. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the terms that apply to what you send.

## 2. Mordheim game content: not covered by the licence

Mordheim, Warhammer and all associated names, marks, rules, background text
and settings are the property of **Games Workshop Limited**. This app is an
unofficial, non-commercial fan project. It is not produced, endorsed or
sponsored by Games Workshop, or affiliated with it.

Parts of `src/data/` reproduce Games Workshop rules text and warband background
text word for word, as transcribed from community sources (mainly
[Mordheimer](https://mordheimer.net)). That text is **not** licensed under the
PolyForm licence above: it isn't ours to license. It is included only so
players of an out-of-print game can keep track of their own campaigns. If you
are a rights holder and want something removed, open an issue or contact the
maintainer and it will be taken down.

The licence in part 1 does cover how that content is organised and modelled in
the app: the JSON schemas, field structure, and the code that reads them.
