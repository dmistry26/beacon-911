# Beacon

**A multilingual, accessible 911 co-pilot with a mass-surge triage mode.** Built for the Congressional App Challenge, CA-19 (southwest San José · Santa Cruz & the Santa Cruz Mountains · Monterey Peninsula · Paso Robles & Atascadero).

> Prototype for demonstration. Synthetic data only. **Not connected to real 911.**

## What it does

| Problem | Beacon |
|---|---|
| Callers who don't speak English | Speak in English, Spanish, Vietnamese, Mandarin, Tagalog or Hindi. Beacon transcribes, translates for the call taker, and speaks the dispatcher's replies back in the caller's language. Mixteco / Triqui callers get an interpreter-bridge flow. |
| Deaf / hard-of-hearing | Live captions, flash + vibration alerts, real-time-text (every keystroke streams to the dispatcher). |
| Blind / low-vision | Voice guidance, large targets, haptics, whole-screen call target. |
| Cannot speak / unsafe to speak | Silent tap-tree (icons → structured report) with Yes/No quick replies. |
| Call surges (wildfire, quake) | **Surge mode**: AI intake answers overflow calls in the caller's language, groups duplicates into events, flags hazard *deltas* ("trapped on 2nd floor") and escalates only what needs a human. One call taker supervises many conversations. |

Pipeline per call: speech→text → translate → classify + extract → vetted protocol card → nearest unit by **road routing** → instructions spoken back in the caller's language, with a **live latency breakdown** per stage.

## Run it

```bash
npm install
cp .env.example .env        # paste a free key from https://console.groq.com  (no card)
npm run demo                # starts Beacon + a free HTTPS tunnel for your phone
```

* One-time: `brew install cloudflared` (free Cloudflare quick tunnel; phones need HTTPS for mic + GPS).
* Dispatcher console: <http://localhost:3000/dispatch/>. Click **📱 Phone** for a QR code, or open the printed `…trycloudflare.com/caller/` URL on your phone.
* No Groq key? It still runs: free MyMemory translation + the built-in rules triage. Add the key for sub-second translation and LLM triage.
* Use **Chrome** (desktop / Android) or **Safari** (iOS) — they provide the free in-browser speech recognition + voices.


## Architecture

```
phone (public/caller)  ──ws──►  server/engine.js  ◄──ws──  console (public/dispatch)
 Web Speech STT/TTS             ├ ai.js        Groq (Whisper-class STT is browser-side) translate + triage
 GPS, RTT, tap-tree             ├ heuristics   deterministic rules triage (always on, offline)
                                ├ protocols    13 pre-translated cards (not AI-generated)
                                ├ fleet.js     stations, units, OSRM road routing, nearest-unit slots
                                ├ geo.js       Nominatim reverse/forward geocoding
                                └ sim.js       surge scenario through the same pipeline
```

* **Protocol cards** are fixed, pre-translated text — the AI only *selects* a card, it never writes medical instructions.
* **Every AI output carries a confidence** and requires a human decision to dispatch; all actions are written to an append-only audit log.
* **Clustering** = incident category + distance radius + time window; **hazard deltas** = new critical tags that the event hadn't seen.
* Demo time-compression: units move `N×` faster than real life (default 6×, selector in the top bar).
* Incidents export as an **EIDO-shaped** JSON (simplified, not schema-validated); locations are held in a PIDF-LO-compatible structure.

## Path to production (honest gaps)

* **CJIS / NG911 i3**: this prototype uses browser audio over the public internet, not SIP/ESInet; the free tiers and tunnels used are not CJIS-covered vendors. Production would self-host open-weight models (the AI layer targets any OpenAI-compatible endpoint via `GROQ_BASE_URL`) inside a CJIS-compliant environment, add SIP/i3 ingress, MFA login, FIPS encryption, and retention policy.
* **Protocol content** is demo content derived from public first-aid guidance; real use needs medical-director approval (and certified-interpreter review of every translation).
* **Translations** of live speech are machine translation; low-confidence output should route to a human interpreter line.
* Fire and police **station addresses are real** (CA-19 agencies, geocoded with OpenStreetMap). Which units each station houses, ambulance posting, and unit movement are simulated.
