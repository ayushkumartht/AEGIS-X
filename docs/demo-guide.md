# Demo guide

A 10-minute walkthrough. Start both servers (see the README quickstart). Everything below works without any API key; with a Groq key the AI text is written by the model, otherwise by fixed templates and rules.

**Say first, in one line:** "A river is rising at Silchar. Here is a plan. Will it hold across every plausible future, and where does it break?"

## 1. Command Center (2 minutes) `/command`

1. Rivers are usually calm, so every district reads **Normal**. Press **Exercise** to switch to a clearly labelled simulated flood ("Brahmaputra and Barak in spate"): 1 severe, 3 warning and 7 watch districts, with CWC gauge readings against their warning and danger levels.
2. Click **Cachar** in the list: the map flies to it. Open a gauge alert to see the level against danger level.
3. Pick an operating mode (for example *Armed Forces*) and press **Generate brief for the exercise**. Read the brief: the situation, where it is worst, recommended actions with *why / what it buys / what it costs / what could break it*, each tied to evidence ids (E1, E2, ...). The evidence is listed underneath.
4. **Accept** or **Reject** a recommendation. The footer shows the decision log and "chain intact".

Say: *the AI only sees the evidence; its numbers are checked against it; if it is wrong the system falls back to rules.*

## 2. Evacuation console (6 minutes) `/console/cachar`

| Step | Tab | Show |
|---|---|---|
| 1 | Situation | Forecast ranges (bars, not a single number), where each input comes from and which are estimates, the what-if sliders |
| 2 | Situation | Add a field report such as `Main bridge is under water`: that bridge's probability changes |
| 3 | Plan | Start time, order of areas, boats, shelters, warning channels. Press **Test this plan on 500 futures** (about 6 seconds, live progress) |
| 4 | Results | Average vs the worst 10% of futures, the histogram of all futures, metrics, **Compare** with the baseline on the same futures, **Explain** in words |
| 5 | Red Team | How often the plan fails, the single points of failure, the conditions under which it fails |
| 6 | Check next | What to find out first (value of information) |
| 7 | Options | Optimiser-suggested plans against the baseline; load one into the editor |
| 8 | Map | Switch to 3D and press **Play a bad day**: the water rises hour by hour and people move |

## 3. Close (2 minutes)

- Press **Accept** in the bar at the bottom. Open `/audit`: the decision, who made it (the name typed in the header), the evidence it rested on, and the hash-chain status.
- Open `/replay/silchar_2022`: the model's advice for the June 2022 flood, day by day.

## Likely questions

- **Is this real data?** Roads, bridges, rain and river forecasts, and official alerts are real. Shelter capacity, boat numbers and how many people obey are estimates and are labelled on screen.
- **Is the model validated?** The river level is calibrated against a 16-year record and the 2022 flood is replayed. Evacuation behaviour is assumed and exposed as sliders.
- **What if the AI is wrong?** It cannot add facts or numbers: each claim cites evidence and is checked against it, otherwise rules write the text. A person still decides.
- **Who is logged in?** Nobody: there are no accounts. The log records the name typed in the header.
