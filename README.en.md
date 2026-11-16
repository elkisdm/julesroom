# Jules Room

Jules Room is a shared 3D room that runs in the browser. Your team walks around with a character, talks by proximity and chats with AI agents. Everyone builds their own room from worlds (templates), furniture and outfits.

It is built with React Three Fiber and LiveKit. The code is open source under AGPL-3.0.

[Versión en español](README.md)

Note: the code, commit messages and most documents are written in Spanish. Issues and pull requests in English are welcome.

## What you can do today

- Create a room from four worlds: Trading, Office, Mansion and Auditorium.
- Pick a name, a character and an outfit.
- Invite someone with a link: they receive your world and your furniture.
- Talk by proximity: you hear whoever is close and stop hearing them as you walk away.
- Talk to AI agents by walking up to them and pressing E, or by typing `@Name message`.
- Change furniture and styles in build mode, and save the room in your browser.

## Run it locally

You need Node 22 (the version it is tested with), pnpm 10 (the repo pins `pnpm@10.0.0`) and `livekit-server` available on your PATH.

```sh
pnpm install
pnpm dev:sala
```

Open http://localhost:5352/crear.html. A longer walkthrough is in [docs/getting-started.md](docs/getting-started.md).

Without a model key, agents answer through a simulated provider and the interface says so.

## Repository layout

| Path                 | What it is                                                       |
| -------------------- | ---------------------------------------------------------------- |
| `packages/oficina`   | 3D engine: worlds, furniture, outfits, animation and room editor |
| `packages/presencia` | Positions and proximity voice on top of LiveKit                  |
| `packages/agentes`   | Agent conversation, Claude provider and simulated provider       |
| `apps/lab`           | Web app: room creation, entry flow and engine lab                |
| `apps/sala`          | LiveKit token server and room client                             |
| `apps/agentes-lab`   | Agent server and conversation test room                          |
| `docs/`              | Guides, architecture decisions (`docs/adr/`) and specifications  |

## Project status

Working locally: a room shared between browsers, proximity voice, agents with streamed replies, a furniture and style editor, and outfits.

Not there yet:

- Accounts or sign-in. The person who creates the room must stay connected to share their world.
- Server-side saving. Rooms are saved in the browser.
- Billing of any kind.
- A production-ready install: TLS, shared history, authenticated quotas, observability and network and load tests are still missing.

Later there will be an official cloud that charges for having the same thing already running. No feature will be exclusive to it.

## Contributing

All the code accepts contributions. Start with [CONTRIBUTING.md](CONTRIBUTING.md) (Spanish, with a short English section at the end). Your first PR asks you to accept the [CLA](CLA.md). See also the [code of conduct](CODE_OF_CONDUCT.md). For vulnerabilities, read [SECURITY.md](SECURITY.md).

## License and trademark

The code is distributed under [AGPL-3.0-only](LICENSE). The name Jules Room, the logo and the Jules character are reserved: see [TRADEMARK.md](TRADEMARK.md). The decisions behind this model are in [docs/adr/0021-modelo-abierto.md](docs/adr/0021-modelo-abierto.md) (Spanish).
