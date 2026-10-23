# Team Doc 3: Sawal-Jawab (judges aur logon ke sawaalon ki taiyaari)

*Kiske liye:* poori team. Presentation ya demo mein jo sawaal aa sakte hain, unke chhote aur sach jawab. Jawab ratne ke liye nahi, samajhne ke liye hain.

Pehle [Doc 1](01-problem-aur-solution.md) aur [Doc 2](02-kaise-kaam-karta-hai.md) padh lo.

---

## A. Problem ke baare mein

**Q1. Aap kaunsi problem solve kar rahe ho?**
Baadh ke waqt officers ko jaldi decide karna padta hai ki kab aur kaise logon ko nikalein, jabki baarish, nadi, pul, boats, logon ka vyavhaar, kuch bhi pakka nahi hota. Aaj yeh andaaze se hota hai. Hum plan ko pehle hi hazaaron possible futures mein test karke batate hain ki woh kitna tikega aur kahan tootega.

**Q2. Yeh problem itni badi kyun hai?**
India mein har saal baadh se lakhon log prabhavit hote hain. Assam, Bihar mein har saal. Silchar 2022 mein aadha shehar doob gaya tha. Galat timing ya galat rasta ki keemat jaanein hoti hain.

**Q3. Silchar hi kyun chuna?**
2022 ki baadh ka asli data hai, Barak nadi ka 16 saal ka record hai, aur district ki official flood report se relief camps ke naam mil gaye. Isse hum model ko asli ghatna par test kar sakte the.

**Q4. Kya officers ke paas pehle se tools nahi hain?**
Hain: mausam forecast, CWC ke nadi alerts, flood maps. Par woh batate hain *kya ho sakta hai*. Koi tool yeh nahi batata ki *mera yeh plan* bure din par kitna tikega aur kis cheez ke tootne se fail hoga. Hum wahi gap bharte hain.

## B. Solution ke baare mein

**Q5. Ek line mein AEGIS-X kya hai?**
Baadh ke plan ka flight simulator: plan ko 500 possible futures mein chalata hai, uski kamzori dhoondhta hai, aur faisla insaan ke haath mein chhodta hai.

**Q6. "500 futures" ka kya matlab?**
Har future ek possible kal hai: kahin baarish zyada, kahin pul band, kahin aadhe boats nahi aaye. Har future mein plan chalake dekhte hain ki kitne log bache. Phir sabko milake range batate hain.

**Q7. Average ke saath "bura din" kyun dikhate ho?**
Kyunki average dhokha deta hai. Plan average mein 88% bacha sakta hai par sabse kharab 10% futures mein sirf 14%. Officer ko yeh pata hona chahiye, kyunki baadh aksar bura din hi hoti hai.

**Q8. Red Team kya karta hai?**
Plan ko todne ki koshish: ek-ek pul, shelter, boat base hata ke dekhta hai ki plan kitna girta hai. Aur batata hai kis haalat mein plan fail hota hai. Jaise army apne plan ki kamzori khud dhoondhti hai.

**Q9. "Check next" kya hai?**
Waqt kam hota hai. Yeh batata hai ki kaunsi jaankari (pul ka haal, boats ki ginti, nadi ka level) pehle pata chal jaaye to plan chunne mein sabse zyada fayda hoga.

**Q10. Command Center kya hai?**
Ek screen jahan poore India ke sarkari baadh alerts (NDMA SACHET: IMD, CWC, state SDMA) aur 22 baadh-prone districts ka level (Normal/Watch/Warning/Severe) live dikhta hai, saath mein AI briefing.

**Q11. Exercise mode kyun banaya?**
Jab nadiyan shaant hoti hain to screen par sab "Normal" hota hai, demo ya training mein kuch dikhta nahi. Exercise mode ek simulated baadh chalata hai: har jagah peela "SIMULATED" label, aur asli data ke saath kabhi mix nahi hota. Training drills ke liye bhi kaam ka hai.

## C. Data ke baare mein

**Q12. Data kahan se aata hai?**
Sadkein aur pul OpenStreetMap se; zameen ki oonchai satellite DEM se; baarish aur nadi ka forecast Open-Meteo/GloFAS se; alerts NDMA SACHET aur GDACS se; relief camps district ki 2024 flood report se; aabadi Census 2011 se.

**Q13. Kya sab data asli hai?**
Nahi, aur hum yeh chhupate nahi. Shelters ki capacity, boats ki ginti (12 maana hai), kitne log order maanenge, aur 41 camps ki exact jagah andaaze hain. Screen par har andaaze ke saath "estimate" likha aata hai.

**Q14. Census 2011 to purana hai?**
Haan. Naya census data abhi public nahi hai, aur ward-wise data online nahi milta. District se asli numbers milte hi file mein daal ke model dobara bana sakte hain.

**Q15. Model sahi hai, kaise pata?**
Nadi ka level 16 saal ke asli record par set kiya aur 2022 ki baadh par din-ba-din test kiya (replay page). Logon ka vyavhaar wala hissa (kitne maanenge, kitni tez chalenge) abhi andaaza hai, use sliders se badal ke test kar sakte ho.

**Q16. Internet band ho gaya to?**
Data cache mein save rehta hai. Offline mode mein system purane saved data se chalta hai, aur saaf batata hai ki data kitna purana hai.

## D. AI ke baare mein

**Q17. AI kya karta hai? Kya woh faisla leta hai?**
Nahi. AI sirf briefing aur explanation likhta hai. Saare numbers humara engine (maths) nikalta hai. Faisla officer leta hai: har recommendation par Accept/Reject.

**Q18. AI galat bol de ya kuch ghad de (hallucination) to?**
AI ko sirf pakke facts ki list milti hai (E1, E2...). Har line ke saath fact ID dena padta hai. System check karta hai: har number facts mein hai? ID asli hai? District sahi hai? Kuch galat to AI ka jawab reject hota hai aur rules se briefing banti hai. Ginti aur engine ke numbers to system khud bharta hai, AI se likhwata hi nahi.

**Q19. Kaunsa AI use karte ho?**
Groq par `openai/gpt-oss-120b` model. Gemini ya Claude bhi laga sakte hain, ek setting badalni hai. AI ke bina bhi poora system chalta hai (tab text rules/templates se banta hai).

**Q20. AI ka kharcha?**
Ek briefing = ek AI call. Groq sasta aur tez hai. Website par rate limit hai taaki koi bar-bar call karke kharcha na badhaye.

## E. Technology ke baare mein

**Q21. Kis technology se bana hai?**
Website React mein, backend Python (FastAPI) mein, maths numpy/scipy se, maps MapLibre/Cesium/three.js se, database SQLite. Live karne ke liye Vercel aur Render.

**Q22. 500 futures chalane mein kitna time?**
Silchar par lagbhag 6 second. Red Team mein zyada (kuch minute), kyunki har pul/shelter ke liye alag test hota hai.

**Q23. Kya yeh sirf baadh ke liye hai?**
Engine kisi bhi aapda ke liye hai: woh sirf ek function bulata hai `simulate(shehar, plan, halaat)`. Baadh ka model bana hai; aag aur bheed (crowd) ke model ka dhaancha taiyaar hai.

**Q24. Tamper-proof register kaise kaam karta hai?**
Har faisle ka ek digital fingerprint banta hai jo pichhle faisle ke fingerprint se juda hota hai (zanjeer). Koi purana record badle to zanjeer toot jaati hai aur system turant dikhata hai.

**Q25. Tested hai?**
Haan, lagbhag 150 automatic tests hain jo engine, flood model, API, AI fact-checker aur register check karte hain. GitHub par har push par chalte hain.

## F. Use aur asar

**Q26. Ise kaun use karega?**
District Disaster Management Authority (DDMA), state SDMA control rooms, NDRF/SDRF planners. Training aur drills ke liye bhi.

**Q27. Army ya Police ke kaam ka hai?**
Command Center mein "Working as" mein Armed Forces, Police, CAPF, Disaster Response modes hain: briefing ki bhasha aur actions ka kram badalta hai (jaise Army: boats, engineers; Police: traffic control). Police ke liye crowd module aage banana hai.

**Q28. Officer ko seekhne mein kitna time?**
Console mein 7 tabs hain, har ek mein sirf ek kaam. Plan ke liye code nahi likhna, sirf sliders aur buttons. Demo guide 10 minute ka hai.

**Q29. Is se kitni jaanein bachengi?**
Hum yeh number dawa nahi karte, kyunki yeh asli trial ke bina nahi pata chal sakta. Hum yeh dikhate hain ki kaunsa plan bure din par behtar tikta hai aur kahan tootta hai, jisse behtar faisla ho sakta hai.

## G. Live, kharcha aur aage

**Q30. Website live kaise hogi?**
Website Vercel par, backend Render par Docker se. Steps `docs/fullstack-deployment-plan.md` mein likhe hain.

**Q31. Login kyun nahi hai?**
Demo aur testing ko aasaan rakhne ke liye hataya. Register mein officer ka likha hua naam jaata hai, jo verify nahi hota. Asli deployment mein organisation apna login/access control laga sakti hai.

**Q32. Aage kya banana hai?**
District se asli shelter capacity aur boats ka data; IMD API ka access; fire aur crowd modules; Hindi/Assamese bhasha; zyada districts ke detailed model.

**Q33. Code open hai?**
Haan, GitHub par MIT license ke saath.

**Q34. Agar district apna data de to kitna kaam?**
Shelters ki CSV file aur boats ki ginti config mein daalni hai, phir ek script chalake model dobara banta hai. Koi code badalna nahi padta.

**Q35. Sabse badi ek cheez jo aapko alag banati hai?**
Imaandari aur test: system sirf prediction nahi deta, plan ko test karta hai aur todne ki koshish karta hai, har andaaza khud batata hai, AI ko facts se baandh ke rakhta hai, aur faisla insaan ka rehta hai.

---

**Yaad rakhne wali 3 lines:**
1. Math decide karta hai, AI samjhata hai, insaan faisla leta hai.
2. Hum average nahi, **bura din** dikhate hain.
3. Jo pakka nahi pata, woh hum screen par khud likh ke batate hain.
