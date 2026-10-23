# Team Doc 4: Humare system ki kamiyan (loopholes) aur unke jawab

*Kiske liye:* poori team. Judges ya users yeh kamiyan pakad sakte hain. Kisi bhi kami ko chhupana nahi hai: maan lo, batao ki humne use kaise sambhala hai, aur aage kya karenge. Imaandari se jawab dena humari taakat hai.

Har kami ke saath: **Kami**, **Kyun hai**, **Abhi kaise sambhala**, **Aage kya**, aur **Agar koi pooche to kya bolein**.

---

## 1. Logon ka vyavhaar andaaza hai

- **Kami:** Kitne % log order maanenge, kitni tez chalenge, boats kitni der se aayenge: yeh sab maane hue numbers hain, asli evacuation data se nahi nikle.
- **Kyun:** India mein past evacuations ka aisa data public nahi hai.
- **Abhi:** Yeh numbers ek pakke number ki jagah **range** mein chalte hain (500 futures mein alag-alag). Situation tab mein sliders se khud badal ke dekh sakte ho. Screen par source likha hai.
- **Aage:** District/NDRF ke past operation reports se range set karna.
- **Bolein:** "Yeh andaaza hai aur hum range mein test karte hain. Isliye hum 'bura din' bhi dikhate hain."

## 2. Shelters ki capacity aur kai camps ki jagah andaaza hai

- **Kami:** 50 relief camps ke naam asli hain, par capacity kahin likhi nahi. 41 camps kisi map par nahi mile, unhe shehar ki oonchi jagah par rakha hai. Upar se 38 maane hue "assembly points" hain.
- **Kyun:** District report mein sirf naam hain; OpenStreetMap par Silchar ke zyada schools mapped hi nahi hain.
- **Abhi:** Capacity 2024 ke asli average se li (Silchar circle: 124 camps mein 34,027 log, yaani ~274 per camp). Map par "assumed location" label. Situation tab mein sab gin ke dikhaya hai.
- **Aage:** District se camps ki list (jagah + capacity) milte hi ek CSV mein daal ke model dobara bana sakte hain.
- **Bolein:** "Naam asli hain, capacity 2024 ke asli average se hai, aur jagah ka andaaza screen par saaf likha hai."

## 3. Boats ki ginti maani hui hai

- **Kami:** Model mein 12 boats aur 6 vehicles maane hain.
- **Kyun:** District ki boat inventory public nahi hai (IDRN sarkari login ke peeche hai).
- **Abhi:** 2022 ki news (Army 9 boats lekar aayi thi) note mein likhi hai; "boats actually available" ka slider hai.
- **Aage:** District EOC se asli list.
- **Bolein:** "Ek config line badalni hai, asli number milte hi."

## 4. Aabadi ka baantwara andaaza hai

- **Kami:** Census 2011 ka total sahi hai (1,78,865), par kaunse area mein kitne log, yeh sadkon ki lambai se baanta hai (jahan zyada sadkein, wahan zyada log maana).
- **Kyun:** Ward-wise data online nahi mila; WorldPop ka satellite population API time-out ho raha tha.
- **Abhi:** Label lagaya hai.
- **Aage:** WorldPop raster ya ward data se.
- **Bolein:** "Total asli hai; area-wise baantwara proxy hai, aur yeh likha hai."

## 5. Baadh ka model simple hai (HAND method)

- **Kami:** Hum dekhte hain ki nadi ka level kisi jagah ki oonchai se upar gaya ya nahi. Paani ka asli behaav (flow, bandh tootna, naalon ka bharna) model nahi karte. Zameen ka data ~90 meter wala hai, jo moti tasveer hai.
- **Kyun:** Asli hydraulic model ke liye detailed data aur bahut computing chahiye; 500 futures seconds mein chalane ke liye simple model zaroori tha.
- **Abhi:** "Forecast error" ko ek alag uncertainty rakha hai; local baarish ka asar bhi juda hai. 2022 par test kiya.
- **Aage:** Behtar DEM (LiDAR) aur bandh ke points; zaroorat ho to ek detailed model se HAND ko calibrate karna.
- **Bolein:** "Yeh decision ke liye screening model hai, engineering design ke liye nahi. Isliye range dete hain, ek number nahi."

## 6. Nadi ka calibration sirf ek ghatna par test hua

- **Kami:** Rating curve 16 saal ke data par set hai, par asli test sirf 2022 ki baadh par hua.
- **Abhi:** 2022 ke 18 din mein asli level humari predicted range ke andar raha.
- **Aage:** 2004, 2017 jaisi aur baadhon par replay; CWC gauge data se seedha calibration.
- **Bolein:** "Ek ghatna par test hua hai, aur hum yeh claim nahi karte ki model fully validated hai."

## 7. GloFAS (nadi forecast) moti tasveer hai

- **Kami:** GloFAS duniya bhar ka model hai (~5 km cells). Chhoti nadiyan theek se nahi dikhti. Kuch districts mein nadi pakdi hi nahi jaati.
- **Abhi:** Har district ke aas-paas 9 se 25 cells mein sabse badi nadi wala cell dhoondhte hain. Agar phir bhi nadi bahut chhoti mile to us district ka level "No indicator" dikhata hai, galat level nahi.
- **Aage:** CWC ke gauge forecasts (jab unka API chale) aur IMD ke district warnings.
- **Bolein:** "Jahan model nadi nahi pakad sakta, wahan hum level dikhate hi nahi."

## 8. AI kabhi-kabhi galat baat likh sakta hai

- **Kami:** Number checker sirf yeh dekhta hai ki number evidence mein hai ya nahi. Agar AI sahi number ko galat jagah laga de (jaise "22 districts severe" jabki 22 to total hai), checker nahi pakad paata. Ek baar AI ne actions bhi khaali chhod diye the.
- **Abhi:** Yeh khud dekha aur theek kiya: ginti aur engine ke numbers ab system khud bharta hai, AI se nahi. AI actions na de to rules wale actions lagte hain aur briefing mein likha aata hai. Har line ke saath evidence ID, aur neeche poora evidence dikhta hai.
- **Aage:** Har claim ka zyada strict check (kaunsa number kis field ka hai).
- **Bolein:** "AI sirf likhta hai. Numbers system bharta hai, aur faisla insaan leta hai jo evidence dekh sakta hai."

## 9. Login nahi hai

- **Kami:** Koi bhi website par plan test kar sakta hai, faisla Accept/Reject kar sakta hai, field report daal sakta hai. Register mein jo naam likha jaata hai woh verify nahi hota.
- **Kyun:** Demo aur testing aasaan rakhne ke liye login hataya.
- **Abhi:** Bhaari kaamon par rate limit hai. Register tamper-proof hai.
- **Aage:** Asli use mein organisation ka login (SSO) ya hosting ka password protection.
- **Bolein:** "Yeh prototype hai; deployment ke waqt access control lagana zaroori hai, aur yeh docs mein likha hai."

## 10. Register ki ek seema

- **Kami:** Zanjeer purani entry badalne ya beech se hataane ko pakadti hai, par **sabse nayi entries** chupke se hata di jayein to nahi pakad sakti. Database ek simple file (SQLite) hai.
- **Abhi:** Yeh limit screen par likhi hai.
- **Aage:** Latest fingerprint ko kahin bahar bhi save karna (jaise roz email ya alag server), aur bada database.
- **Bolein:** "Tamper-evident hai, tamper-proof nahi; aur hum yeh khud batate hain."

## 11. Alerts ki jagah hamesha nahi milti

- **Kami:** Kai alerts (jaise Andhra ke coded mandal naam) ki jagah nahi milti; woh list mein dikhte hain, map par nahi. SACHET ka polygon link 403 deta hai.
- **Abhi:** CWC alerts mein gauge ki jagah hoti hai; district naam se match; baaki address search se.
- **Aage:** LGD district codes ki table se mapping.
- **Bolein:** "Jo locate nahi hota, use galat jagah nahi rakhte."

## 12. Kuch sarkari sources abhi band hain

- **Kami:** IMD ka district API server ka IP whitelist maangta hai; CWC ki site time-out hoti hai; ReliefWeb ko app-name chahiye; NASA FIRMS (aag) ko key chahiye.
- **Abhi:** IMD aur CWC ke alerts SACHET se aa jaate hain. Har source ki health screen par dikhti hai.
- **Aage:** In sabke liye request bhejni hai.
- **Bolein:** "Jo source band ho, screen par 'unavailable' likha aata hai."

## 13. Detailed model sirf ek district ka hai

- **Kami:** Poora evacuation model sirf Cachar (Silchar) ka bana hai. Baaki 21 districts ka sirf baadh level dikhta hai.
- **Abhi:** Command Center Cachar se seedha console kholta hai. Naya district banane ki scripts taiyaar hain.
- **Aage:** Har naye district ke liye config + data fetch + build script (ghante ka kaam, data mil jaye to).
- **Bolein:** "Pipeline repeatable hai; ek district end-to-end proof hai."

## 14. Kuch kaam dheere hain

- **Kami:** Red Team Silchar par kuch minute leta hai. Pehli AI briefing (jab engine chalta hai) ek-do minute.
- **Abhi:** Engine ke numbers 30 minute cache hote hain; background mein pehle se taiyaar ho jaate hain.
- **Aage:** Red Team mein kam futures ka fast mode, aur zyada servers.
- **Bolein:** "500 futures 6 second mein; gehri analysis mein minute lagte hain, jo decision ke waqt chalega."

## 15. Exercise ka data nakli hai

- **Kami:** Exercise mode ke alerts aur levels banaye hue hain; galat jagah use ho to bhram ho sakta hai.
- **Abhi:** Har jagah peela "SIMULATED EXERCISE" label; sirf us viewer ki screen par; live data ke saath kabhi mix nahi; exercise par liye faisle register mein "exercise" ke saath save.
- **Bolein:** "Yeh training ke liye hai, aur system kisi ko use asli samajhne nahi deta."

## 16. Fire aur Crowd modules abhi nahi bane

- **Kami:** Screen par "later" likha hai.
- **Aage:** Fire ke liye NASA FIRMS key; crowd ke liye venue aur bheed ka data kisi partner (police/venue) se.
- **Bolein:** "Engine domain-free hai; naya module wahi interface implement karta hai."

## 17. Sensitivity simple method se

- **Kami:** Red Team tab mein "What matters most" chart correlation se banta hai, jo seedha cause nahi batata.
- **Abhi:** Asli Sobol method (behtar) API mein maujood hai.
- **Aage:** UI mein Sobol ka option.

## 18. Frontend ke automatic tests nahi

- **Kami:** Backend ke ~150 tests hain; website ke sirf type-check aur build chalte hain, click-wale tests nahi.
- **Aage:** Kuch end-to-end tests (Playwright).

## 19. Bhasha aur mobile

- **Kami:** Website sirf English mein; mobile par chalti hai par mainly bade screen ke liye bani hai.
- **Aage:** Hindi aur Assamese; field officers ke liye mobile view.

## 20. Hosting ki seema

- **Kami:** Render ka free plan 15 minute khaali rehne par so jaata hai (pehla request ek minute), aur free plan mein disk nahi: register reset ho sakta hai. Background collector ek hi process mein chalna chahiye.
- **Aage:** Paid instance aur persistent disk; bade scale par asli database.

## 21. Decision score ek choice hai

- **Kami:** "Check next" ka score = bache log minus 0.3 × bekar mein nikale log. Yeh 0.3 humne chuna hai.
- **Abhi:** Formula screen par likha hai.
- **Aage:** Officers ke saath milke weight tay karna, ya setting bana dena.

## 22. Ek purani suraksha chook

- **Kami:** Groq ki API key ek baar chat mein share hui thi. Aur ek baar live-feed ki cache files galti se Git mein chali gayi thi (ab hata di, ignore mein hain, par purani history mein hain).
- **Abhi:** Key `.env` mein hai jo Git mein nahi jaati.
- **Karna hai:** **Live se pehle nayi key banao aur purani delete karo.**

---

## Jawab dene ka tarika (team ke liye)

1. **Kami maan lo**: "Haan, yeh andaaza hai."
2. **Batao humne kya kiya**: label, range, slider, fallback.
3. **Batao aage kya**: "District ka data milte hi..."
4. **Kabhi bada claim mat karo** jo hum prove nahi kar sakte (jaise "itni jaanein bachengi").

> Judges ko sabse zyada yeh pasand aata hai ki team ko apni kamiyan pata hain aur system unhe chhupata nahi.
