# Flood Evacuation: The Problem

> **One line:** During a flood, the people in charge must choose an evacuation plan before they know how bad the flood will get, and today they have no way to test that plan before real lives depend on it.

---

## 1. Background

Floods are India's most frequent large-scale disaster. Every monsoon, districts in Assam, Bihar, Kerala, Tamil Nadu, Maharashtra, Uttarakhand and others have to move thousands of people out of danger in a short time.

Past events show the same pattern again and again:

- **Chennai, 2015:** Extreme rainfall and a large reservoir release flooded large parts of the city. Many areas were cut off, and people were stuck on rooftops for days.
- **Kerala, 2018:** Many dams opened together during record rain. Lakhs of people had to be moved to relief camps, and many rescues happened only after areas were already cut off.
- **Assam:** Floods every year, with roads, embankments and bridges failing in different places each year.

In most of these cases, the hardest part was not the rescue work itself. It was **making the right decisions early**, while information was incomplete and the situation kept changing.

> Before using any figures (deaths, people evacuated, area affected) in the presentation, take them from official sources: NDMA, state SDMA reports, or CAG/inquiry reports.

---

## 2. Who has to make the decisions

| Role | What they decide |
|---|---|
| District Collector / DDMA (District Disaster Management Authority) | When to order an evacuation, which areas go first, which shelters to open |
| Emergency Operations Centre (EOC) | Where to send boats, vehicles and teams, and in what order |
| NDRF / SDRF team commanders | Which route to take, and which locality to rescue first |
| Police / Fire / Health | Traffic control, medical support, clearing roads |

These people are experienced, but they decide **under pressure, with partial information, and with no way to try a plan out first.**

---

## 3. The decisions they must make

During a flood, the decision-maker has to answer questions like these, often within a few hours:

1. **When** should we start evacuating? Too early wastes resources and loses public trust. Too late and roads are already under water.
2. **Which areas** should go first?
3. **Where** should each locality be sent? Which shelter, and by which route?
4. **How** should limited boats, vehicles and rescue teams be split across areas?
5. **What** should be done in advance: pre-position boats, reinforce a road, open an extra shelter?
6. **What should we do if** the bridge goes under, half the boats don't arrive, or the phone network fails?

---

## 4. Why this is hard

This is the core of the problem. It is not one difficulty but several at once.

### 4.1 The future is uncertain
- A rainfall forecast is a **range** (for example 80–250 mm), not a single number.
- The water level depends on rainfall, dam releases, drainage and terrain, and all of these are uncertain.
- A plan that works at 100 mm of rain may fail completely at 200 mm.

### 4.2 The situation keeps changing
- Roads and bridges become unusable **one by one** as the water rises.
- A route that is safe at 6 PM may be cut off by 8 PM.
- A plan made in the morning may no longer fit the reality by evening.

### 4.3 Information is incomplete and conflicting
- Reports come from many places: control room calls, field teams, social media, CCTV, weather departments.
- They often **disagree** ("bridge is open" from one source, "bridge is under water" from another).
- Some information is **old** by the time it arrives.
- Nobody knows exactly how much to trust each source.

### 4.4 Resources are limited and unreliable
- There are only so many boats, vehicles, NDRF teams and shelter places.
- Some resources **don't show up** in time: boats are stuck elsewhere, vehicles break down, teams are delayed.
- Resources sent to one area are not available for another.

### 4.5 Communication breaks down
- Power cuts and damaged towers degrade mobile networks.
- Orders reach teams late, or not at all.
- Coordination between teams gets worse just when it matters most.

### 4.6 Plans have hidden weak points
- A plan may depend on **one bridge, one road or one shelter** without anyone noticing.
- If that one thing fails, the whole plan fails.
- These dependencies are usually found **only after** the failure has happened.

### 4.7 There is no time, and no second chance
- Decisions must be made in hours, sometimes minutes.
- A wrong decision cannot be undone; it costs lives.

---

## 5. What is missing today

| What exists today | What it lacks |
|---|---|
| **District Disaster Management Plans** | Written once a year and mostly static. They don't adapt to today's actual flood, road closures or available resources. |
| **Weather and flood forecasts** | Usually give one expected value. They don't show what the forecast means for *my evacuation plan*. |
| **Dashboards and command centres (ICCCs)** | Show what is happening **now**. They don't answer "what happens next if we do X?" |
| **Experience and judgement of officers** | Valuable, but can't be tested beforehand, is hard to explain or audit, and stays with the person. |
| **Mock drills** | Test one fixed scenario, a few times a year. They can't cover the many ways a real flood can unfold. |
| **After-action reviews** | Lessons are written down but rarely feed back into the next plan in a structured way. |

**The gap:** nothing today lets a decision-maker **test a plan against many possible futures *before* acting**, see **where and why it would fail**, and know **which missing information matters most**.

---

## 6. An example (fictional)

> A riverside town has **6 low-lying localities** with about **400 people** in them.
> There are **3 shelters** on higher ground, and **one main bridge** connects the low side to two of them.
> The district has **12 boats**.
> The rainfall forecast for the next 12 hours is **80 to 250 mm**.
>
> The Collector's team proposes a plan: send 4 boats to each shelter, and evacuate localities in order of distance.
>
> **Questions nobody can answer with confidence today:**
> - What share of people does this plan get out if rain is 100 mm? 180 mm? 250 mm?
> - What happens if the main bridge goes under at hour 3?
> - What if only 8 of the 12 boats are available?
> - What if radio contact with field teams drops by 30%?
> - Is there a different split of boats that does slightly worse on an average day but **much better on a bad day**?
> - Should we spend the next hour sending a drone to check the bridge, or checking how many boats are actually ready? Which one helps us decide better?

Today these questions are answered by gut feeling, or not at all.

---

## 7. The problem statement

> **How can a flood-response decision-maker, working with uncertain, incomplete and changing information and limited resources, know *before acting* how an evacuation plan will hold up across the range of possible futures, where and why it will fail, and which information is most worth gathering next, while keeping the final decision in human hands?**

### Sub-problems

| # | Sub-problem |
|---|---|
| **P1** | Bring together reports from different sources that are incomplete or contradict each other, and represent how much each one can be trusted. |
| **P2** | Understand how a plan performs across **many possible futures**, not just one forecast. |
| **P3** | Compare two or more plans **fairly**, under exactly the same conditions. |
| **P4** | Find the **hidden weak points** of a plan (a critical bridge, shelter or resource) before they fail. |
| **P5** | Know **which uncertainty matters most** for the outcome (rain? boats? communication?). |
| **P6** | Know **which information to collect next** to make a better decision. |
| **P7** | Balance competing goals: people saved, time taken, resources used, and safety on bad days. |
| **P8** | Re-check the plan **quickly** when conditions change (heavier rain, fewer resources, comms down). |
| **P9** | Keep the **human in control**, with clear reasons they can understand, question and override. |
| **P10** | **Learn** from each real event or drill so the next prediction is better. |

---

## 8. Scope

### In scope
- Evacuating people from flood-affected areas to shelters
- Deciding on and allocating evacuation resources (boats, vehicles, teams)
- Shelter and route selection
- Planning under uncertainty in rainfall, resources and communication
- Before-event planning and during-event re-planning

### Out of scope
- **Making flood forecasts.** We take forecasts from IMD, CWC and similar agencies as input and do not replace them.
- Running the rescue operation itself (field execution)
- Relief camp management after evacuation (food, health, sanitation)
- Long-term flood prevention (dams, embankments, urban drainage)
- Building new sensor or drone hardware

---

## 9. How we will know the problem is solved

A solution is successful if a decision-maker can:

1. Take a proposed plan and see how it performs across **hundreds of possible futures**, as a range of outcomes rather than one number.
2. See the plan's **worst-case behaviour**, not just its average.
3. Be told **specifically** what breaks the plan (for example "fails when rain is above X mm *and* the main bridge is closed").
4. Compare plans side by side under **identical conditions**.
5. Know **which uncertainty to reduce first**, and why.
6. Change conditions or the plan and get an updated answer in **seconds**, not hours.
7. Understand **why** the system says what it says, and accept, change or reject it.

---

## 10. Key terms

| Term | Meaning |
|---|---|
| **Scenario** | The situation: map, localities, people, shelters, roads, resources |
| **Plan** | The decision being tested: resource split, evacuation order, routes, preparations |
| **Future / condition** | One possible way things could turn out (for example 180 mm rain, 70% of boats available, 20% comms loss) |
| **Single point of failure** | One element (bridge, shelter, resource) whose failure brings down the whole plan |
| **Resilience** | How well a plan performs on **bad** days, not just on average days |
| **Value of information** | How much better our decision gets if we learn something we don't know yet |
