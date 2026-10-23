# Team Doc 2: AEGIS-X kaam kaise karta hai (architecture, aasaan bhasha mein)

*Kiske liye:* team ke log jo samajhna chahte hain ki andar kya chal raha hai. Thode technical shabd aayenge, par har ek ka matlab saath mein likha hai.

Pehle [Team Doc 1](01-problem-aur-solution.md) padh lo: problem aur solution wahan hai.

---

## 1. Poori tasveer ek nazar mein

```
   SARKARI DATA (internet se)                 AEGIS-X KA DIMAAG (backend)                    SCREEN (frontend)
 ┌──────────────────────────┐          ┌───────────────────────────────────┐          ┌────────────────────────┐
 │ NDMA SACHET alerts        │          │ 1. Data collector (har 10 min)     │          │ Command Center          │
 │ (IMD, CWC, state SDMA)    │ ───────▶ │ 2. Flood model (Silchar ka nakli   │ ◀──────▶ │  - India map, alerts    │
 │ GDACS (badi aapdaayein)   │          │    shehar computer mein)           │          │  - districts ka level   │
 │ Nadi + baarish forecast   │          │ 3. Engine (500 futures, Red Team,  │          │  - AI briefing          │
 │ (GloFAS / Open-Meteo)     │          │    check-next, best plans)         │          │                         │
 │ OpenStreetMap (sadkein)   │          │ 4. AI writer + fact-checker        │          │ Evacuation Console      │
 └──────────────────────────┘          │ 5. Register (database)             │          │  - plan banao, test karo│
                                        └───────────────────────────────────┘          │ Decision Log            │
                                                                                         └────────────────────────┘
```

Teen hisse hain:
- **Frontend** = jo screen par dikhta hai (website). React naam ki technology se bana.
- **Backend** = peeche ka dimaag jo calculation karta hai. Python mein bana (FastAPI).
- **Data** = sarkari aur open sources se aane wali jaankari.

## 2. Step by step: data se faisle tak

### Step 1: Shehar ka "digital twin" banana
Silchar ko computer mein ek nakli shehar ki tarah banaya:
- **Sadkein aur pul**: OpenStreetMap (duniya ka free map) se. Sadkon ko ~6,600 points aur ~7,250 tukdon mein toda.
- **Zameen ki oonchai**: satellite data (har ~90 meter par). Isse pata chalta hai ki nadi ka paani kitna badhe to kaunsi jagah doobegi. Ise **HAND** kehte hain: "nadi ke normal level se kitni oonchai".
- **Log**: Census 2011 (1,78,865 log), 196 areas mein baante.
- **Shelters**: 50 asli relief camps + kuch OSM buildings + kuch maane hue oonche points.
- **Pul**: 8 sabse zaroori pul chune.

### Step 2: Nadi ka level samajhna (calibration)
Forecast hume batata hai ki nadi mein **kitna paani behega** (cubic meter per second). Par hume chahiye **kitne meter upar** paani aayega. Iske liye ek formula (rating curve) chahiye.
- 16 saal (2010-2025) ka asli nadi data liya.
- Normal level = har saal ki sabse badi baadh ka median (lagbhag har 2 saal mein aane wali baadh).
- Phir **2022 ki baadh** par din-ba-din check kiya ki humara model sahi range deta hai ya nahi.

### Step 3: Ek "future" ko simulate karna
Ek future matlab: ek possible kal. Usme yeh sab cheezein ek-ek value le leti hain (baarish, nadi ka peak, pul khula ya band, kitne boats aaye, kitne log maane). Phir computer **48 ghante ko ghanta-ghanta** chalata hai:
- Paani badhta hai, neeche ki sadkein doobti hain
- Warning logon tak pahunchti hai (siren, SMS, door-to-door)
- Log chalte hain ya boats se nikalte hain, sabse paas ke khule rasta wale shelter tak
- Shelter bhar jaaye to agle shelter jaate hain

Ant mein nateeja: kitne % log time par safe pahunche, kitne late, kitne bekar mein nikale gaye, etc.

### Step 4: Engine: 500 futures aur unka vishleshan
"Engine" woh hissa hai jo kisi bhi aapda par kaam kar sakta hai (baadh, aag, bheed). Yeh karta hai:

| Kaam | Asaan matlab |
|---|---|
| **Monte Carlo** | 500 alag futures chalao (lagbhag 6 second). Range nikalo: average, bura din (worst 10%). |
| **Red Team** | Ek-ek pul/shelter/base hatake dekho plan kitna girta hai. Fail hone wale futures mein pattern dhoondho. |
| **Sensitivity** | Kaunsi "pakki-nahi" cheez nateeje ko sabse zyada hilaati hai. |
| **Value of Information** | Kaunsi jaankari pehle mil jaaye to decision sabse behtar hoga ("pehle kya check karein"). |
| **Optimiser** | Bahut saare plans try karke sabse achhe trade-off wale 3 plan dikhao. |
| **Compare** | Do plans ko **bilkul same 500 futures** par chalao, taaki farak sirf plan ka ho, kismat ka nahi. |

Ek important design rule: **engine ko baadh ke baare mein kuch nahi pata.** Woh sirf ek function bulata hai: `simulate(shehar, plan, halaat) → nateeja`. Isliye kal ko aag ya bheed ka model bhi isi engine se chalega.

### Step 5: Command Center ka data
Backend har **10 minute** mein:
- **NDMA SACHET** se ~100 latest alerts laata hai. Har alert ka English hissa padhta hai. CWC ke alerts mein nadi gauge ka level, warning level aur danger level hota hai, woh bhi nikal leta hai.
- **GDACS** se badi baadh/cyclone events.
- Har alert ki jagah dhoondhta hai (alert mein likhe district ke naam se, ya address se search karke).

Har **3 ghante** mein 22 districts ke liye:
- Pichhle 20 saal ke data se us nadi ki **2-saal, 5-saal aur 20-saal wali baadh** kitni badi hoti hai, yeh nikalta hai.
- Agle 7 din ke forecast (51 alag versions) mein se kitne % in seemaon ko paar karte hain.
- 30% se zyada versions 20-saal wali baadh paar karein = **Severe**; 5-saal = **Warning**; 2-saal = **Watch**; warna **Normal**.

Agar koi source band ho jaaye, screen par likha aata hai "unavailable, last worked X min ago". Purana data naya bana ke nahi dikhaya jaata.

### Step 6: AI briefing (aur uska fact-checker)
Yeh sabse dhyaan se banaya hissa hai:

1. **Saboot jama karo**: system pehle khud facts ki list banata hai: alerts, districts ka level, aur jahan model bana hai (Cachar) wahan engine ke tested numbers. Har fact ko ek ID milta hai: E1, E2, E3...
2. **AI se likhwao**: Groq AI ko sirf yeh list di jaati hai. Use fixed format mein likhna hota hai: situation, sabse bura kahan, actions (har action ke saath: kyun, kya milega, kya kharcha, kya bigad sakta hai), pehle kya check karein, kya pakka nahi. **Har line ke saath fact IDs dene hote hain.**
3. **Check karo**: system dekhta hai:
   - Har number facts mein maujood hai?
   - Har ID asli hai?
   - District ka naam sahi hai?
   - Format theek hai?
   Kuch bhi galat hua to AI ka jawab phenk do aur **rules se** briefing likho.
4. **Zaroori cheezein system khud bharta hai**: districts ki ginti aur engine ke numbers AI se nahi likhwaye jaate; system khud daalta hai (kyunki AI kabhi-kabhi sahi number galat jagah laga deta hai).

### Step 7: Faisla aur register
- Officer har action par **Accept/Reject** dabata hai, saath mein note likh sakta hai.
- Faisla database mein save hota hai, saath mein: kisne kiya (header mein likha naam), kab, aur kaunse facts par.
- Har entry ka ek **digital fingerprint (hash)** banta hai jo pichhli entry ke fingerprint se juda hota hai, jaise zanjeer. Koi purani entry badle to zanjeer toot jaati hai aur `/audit` page par laal mein dikhta hai.

## 3. Website ke pages

| Page | Kya hai |
|---|---|
| `/command` | Command Center: India map, alerts, 22 districts, AI briefing, Exercise button |
| `/console/cachar` | Evacuation Console: Silchar ka map (3D/2D) + 7 tabs (Situation, Plan, Resources, Results, Red Team, Check next, Options) |
| `/audit` | Decision Log: saare faisle aur zanjeer sahi hai ya nahi |
| `/replay/silchar_2022` | 2022 ki baadh ka din-ba-din replay |
| `/demo` | Bina internet chalne wala nakli district (practice ke liye) |

## 4. Technology (naam yaad rakhne ke liye)

| Hissa | Technology | Ek line mein |
|---|---|---|
| Website | React, Vite, Tailwind | Modern web pages banane ke tools |
| Maps | MapLibre (2D), Cesium (asli 3D zameen), three.js (3D lite) | Map aur 3D dikhane ke libraries |
| Backend | Python, FastAPI | Calculation aur data ka server |
| Maths | numpy, scipy | Tez calculation ke libraries |
| Database | SQLite | Ek file mein chalne wala chhota database |
| AI | Groq (model `openai/gpt-oss-120b`) | Briefing aur explanation likhne ke liye |
| Live karna | Vercel (website), Render (backend, Docker) | Internet par chalane ke liye |

## 5. Ek alert ka safar (example)

1. CWC ne alert bheja: "Gandak nadi Dumariaghat (Gopalganj, Bihar) par 61.38 m, warning level 61.22 m, danger 62.22 m."
2. 10 minute ke andar humara collector use SACHET se utha leta hai, gauge ke numbers aur jagah nikal leta hai.
3. "Gopalganj" humari 22 districts ki list mein hai, to alert us district se jud jaata hai.
4. Command Center par map par point dikhta hai, aur district ke saath "1 active alert, gauge 61.38 m (danger 62.22 m)".
5. Briefing banane par yeh fact E-number ke saath AI ko jaata hai, aur action mein "why" ke saath cite hota hai.

## 6. Safety ke design niyam

- **Math decide karta hai, AI sirf samjhata hai, insaan faisla leta hai.**
- **Andaaze ko data ki tarah kabhi mat dikhao**: har estimate par label.
- **Source band ho to saaf batao**, purana data naya bana ke mat dikhao.
- **Exercise data kabhi live data ke saath mix nahi hota**, aur har jagah "SIMULATED" likha aata hai.
- **Login nahi hai**: website par koi bhi kaam kar sakta hai; register mein jo naam likha jaata hai woh verify nahi hota. (Isliye public deploy par apna access control lagana chahiye.)
