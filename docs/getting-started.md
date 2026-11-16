# Getting started

From a clean clone to a working room on your machine. Versión en español: [guia-de-inicio.md](guia-de-inicio.md).

## Requirements

- Node 22 (the version it is tested with).
- pnpm 10. The repo pins `pnpm@10.0.0` in `packageManager`.
- `livekit-server` on your PATH. It is the voice and positions server; `pnpm dev:sala` starts it in development mode. Install it following the LiveKit documentation.
- A modern browser with WebGL. A microphone if you want to test voice.

## Steps

1. Clone the repository and enter the folder.
2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Start the full room from the repo root:

   ```sh
   pnpm dev:sala
   ```

4. Open http://localhost:5352/crear.html.

`pnpm dev:sala` starts three services: LiveKit, the token and agents server, and the web app. Ports, all on loopback only: web 5352, tokens 8797, agents 8798, LiveKit 7880 (signaling), 7881 (TCP) and 7882 (UDP). If one is taken, the script fails without touching the process that holds it. Ctrl+C stops what it started.

## Create your room and join from a second browser

1. In `crear.html` pick a world, a name, a character and agents. Continue to the "Invitar" (invite) step.
2. Copy the invitation link and join first. The room owner must stay connected, because they share their world and furniture.
3. Open the link in another browser or profile. The guest picks a name and clothes, and receives the owner's world and furniture.
4. Bring both characters close and press "Usar mi voz" (use my voice). The explanation appears before the browser asks for microphone permission. If you walk more than 5.625 meters away, you stop hearing the other person.

To talk to an agent, walk up and press E, or type `@Name hello` using an agent name from your world.

## AI model: simulated or your own key

Without a key, agents use a simulated provider and the interface says so. You need nothing else to try it.

To use Claude with your own key, the server looks for a `.env` file outside the repo at `~/.config/oficina-agentes/.env`, with the variable `ANTHROPIC_API_KEY`. The server reads it in memory and does not copy or log it. Restart `pnpm dev:sala` after creating it.

To force the simulated provider even if you have a key:

```sh
SALA_SIMULADA=1 pnpm dev:sala
```

## Tests, typecheck and lint

From the root:

```sh
pnpm test
pnpm typecheck
pnpm lint
```

For a single app or package, for example the engine:

```sh
pnpm -F @oficina/motor test
```

The browser tests for the room need Chrome installed and the room running with `SALA_SIMULADA=1 pnpm dev:sala`. In another terminal:

```sh
node apps/sala/e2e/envivo.mjs --video
node apps/sala/e2e/resiliencia-envivo.mjs
```

## Common problems

- **Port in use.** The script fails with "Puerto N ocupado". Close whatever uses it and try again.
- **`livekit-server` not found.** Check that the command works in your terminal before running `pnpm dev:sala`.
- **You cannot hear the other character.** Bring them closer. Voice starts at 4.5 m and is cut beyond 5.6 m. Also check the browser's microphone permission.
- **Agents answer with sample text.** No key is configured, or `SALA_SIMULADA=1` is set.
- **No voice services.** `pnpm --filter @oficina/lab dev --port 5352` opens the single-player room, without the shared room.

Technical details on startup, the whiteboard and end-to-end tests are in [apps/lab/servidor/README.md](../apps/lab/servidor/README.md) (Spanish). What does not exist yet (accounts, server-side saving, billing) is listed in the [README](../README.en.md).
