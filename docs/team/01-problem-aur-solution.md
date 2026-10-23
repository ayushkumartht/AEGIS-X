# Team Doc 1: Problem kya hai aur humne kya banaya


## 1. Ek kahani se shuru karte hain

June 2022. Assam ka **Silchar** shehar. Barak nadi ka paani badhta gaya, bandh (embankment) toot gaya, aur kuch hi ghanton mein aadha shehar paani mein tha. Lakhon log phase, kai din tak bijli, paani, khana nahi mila.

Us waqt district ke officers ke saamne sawaal yeh the:

- **Kab** logon ko nikalna shuru karein? Bahut jaldi kiya to log naraz, shelters bhar jaate hain, aur agar baadh aayi hi nahi to agli baar log baat nahi maante. Bahut der ki to sadkein doob chuki hoti hain.
- **Kaun se area pehle?** Sabse neeche wale? Sabse zyada aabadi wale?
- **Boats kahan rakhein?** District ke paas gine-chune boats hote hain.
- **Kaunse shelters kholein?** Kya unme sabke liye jagah hai?
- **Kaunsa pul (bridge) bharose ka hai?** Agar pul doob gaya to aadha plan bekaar.

## 2. Asli problem: "agar" bahut saare hain

Yeh decisions mushkil isliye hain kyunki koi pakka nahi bata sakta ki kal kya hoga:

| Kya pakka nahi pata | Kyun farak padta hai |
|---|---|
| Kitni baarish hogi | Thodi zyada baarish = paani kuch feet zyada |
| Nadi kitni upar jayegi | Kaunse area doobenge, yeh isi se tay hota hai |
| Pul khula rahega ya doobega | Rasta band = log phase |
| Kitne boats sach mein aayenge | Kagaz par 12, asal mein 7 bhi ho sakte hain |
| Kitne log order maanenge | Sab nahi maante; kai log ghar chhodna nahi chahte |
| Phone/network chalega ya nahi | Warning pahunchegi ya nahi |

Aaj officers yeh sab **anubhav aur andaaze** se tay karte hain. Ek plan banta hai, aur kisi ko nahi pata ki woh plan **bure din** par kitna tikega, ya woh **kis wajah se** fail ho sakta hai.

> Ek line mein problem: **baadh ke waqt decision ek hi baar lena padta hai, galti ka mauka nahi milta, aur hazaar cheezein pakki nahi hoti.**

## 3. Humara solution: AEGIS-X

Humari tagline hai: **"Test the decision before reality does."** Matlab: asli baadh se pehle hi plan ko computer par hazaaron baar test kar lo.

Socho jaise pilot asli plane udane se pehle **flight simulator** mein practice karta hai. AEGIS-X baadh ke plan ka flight simulator hai.

### AEGIS-X kya-kya karta hai (simple shabdon mein)

**1. Ek plan, 500 alag-alag "kal".**
Officer apna plan daalta hai: kab shuru karna hai, kaunsa area pehle, kitne boats kahan, kaunse shelters. Computer us plan ko 500 alag possible futures mein chalata hai: kahin baarish zyada, kahin pul doob gaya, kahin aadhe boats nahi aaye. Phir batata hai:
- **Average din par** kitne % log time par safe pahunche
- **Bure din par** (sabse kharab 10% futures) kitne % bache

**2. Red Team: plan ko todne ki koshish.**
Army mein "red team" woh hoti hai jo apne hi plan mein kamiyan dhoondhti hai. Humara Red Team computer batata hai:
- Kitne % futures mein plan fail hota hai
- **Kaunsi ek cheez** (koi pul, shelter, boat base) hat jaye to plan toot jaata hai
- Kis haalat mein (jaise "baarish itne mm se zyada aur nadi itne meter upar") plan fail hota hai

**3. "Pehle kya check karein?"**
Waqt kam hai. Kya pehle pul ka haal check karein ya boats ki ginti? System batata hai ki **kaunsi jaankari pata chalne se decision sabse zyada behtar hoga**.

**4. Behtar plan khud suggest karna.**
Computer kai plan try karke 3 option deta hai: "bure din par sabse safe", "average mein sabse achha", "sabse kam boats wala". Officer koi bhi chun ke usme badlav kar sakta hai.

**5. Command Center: poore desh par nazar.**
Ek screen par:
- **Sarkari alerts live**: IMD (mausam vibhag), CWC (nadi ke gauges ka paani ka level), state disaster authorities. Yeh NDMA ke official system **SACHET** se aate hain.
- **22 baadh-prone districts** (Assam, Bihar, UP, Bengal, Odisha, etc.) ka level: Normal, Watch, Warning ya Severe. Yeh agle 7 din ke nadi forecast se nikalta hai.
- India ka map jahan sab dikhta hai.

**6. AI briefing.**
Ek AI (Groq) poori situation ka chhota sa briefing likhta hai: kya ho raha hai, kahan sabse bura hai, kya karna chahiye, kya pakka nahi hai. **Lekin** AI ko sirf wahi facts diye jaate hain jo humare paas pakke hain, aur har line ke saath batana padta hai ki woh kis fact par based hai. Agar AI kuch apni taraf se ghad deta hai, system use reject karke apne rules se briefing likh deta hai.

**7. Faisla insaan ka.**
System sirf suggest karta hai. Har recommendation par officer **Accept** ya **Reject** dabata hai. Har faisla ek **tamper-proof register** mein save hota hai: kisne, kab, kis jaankari ke base par. Koi baad mein chupke se badal de to system pakad leta hai.

**8. Exercise mode (practice drill).**
Jab sab nadiyan shaant hon (jaise abhi), screen par sab "Normal" dikhta hai. Practice ke liye ek **simulated baadh** ka button hai. Har jagah peela banner aata hai "SIMULATED EXERCISE", taaki koi use asli na samjhe.

## 4. Humne asli mein kya banaya (proof)

- **Silchar (Cachar) ka poora digital model**: asli sadkein aur pul (OpenStreetMap se), zameen ki oonchai, 196 areas, Census ke hisaab se 1.78 lakh log, 90 shelters.
- **50 asli relief camps** jo district ne 2024 ki baadh mein khole the (district ki official report se naam liye).
- Nadi ka model **16 saal ke asli data** par set kiya, aur **2022 ki baadh** par din-ba-din test kiya.
- **3D map**: asli zameen par paani ghanta-ghanta badhta dikhta hai, log shelters ki taraf jaate dikhte hain.
- Website: Command Center + Evacuation Console + Decision Log.
- Lagbhag **150 automatic tests** jo har badlav ke baad check karte hain ki kuch toota to nahi.

## 5. Kya asli hai aur kya andaaza (imaandari wala hissa)

| Asli data | Andaaza (screen par "estimate" likha aata hai) |
|---|---|
| Sadkein, pul, nadi | Shelters ki capacity (kitne log samayenge) |
| Zameen ki oonchai | 41 relief camps ki exact jagah (map par nahi milte) |
| Baarish aur nadi ka forecast | Boats ki ginti (12 maana hai) |
| Sarkari alerts (SACHET) | Kitne % log order maanenge |
| Relief camps ke naam | Logon ka area-wise baantwara |

Hum yeh sab screen par khud likh kar dikhate hain. Yahi humari sabse badi taakat hai: **system jhooth nahi bolta ki use sab pata hai.**

## 6. Hum alag kyun hain

| Aam tools | AEGIS-X |
|---|---|
| Ek prediction dete hain ("kal 8 feet paani") | 500 possible futures, aur **range** batata hai |
| Sirf map dikhate hain | Plan ko **test** karta hai aur **todne** ki koshish karta hai |
| AI jo chahe bol deta hai | AI sirf facts se bolta hai, har number check hota hai |
| Faisla kaun le raha hai, record nahi | Har faisla evidence ke saath tamper-proof register mein |

## 7. Aage kya

- **Fire** (aag) aur **Crowd** (mele/bheed ki safety, police ke liye) modules: dhaancha taiyaar hai, banana baaki hai.
- District se asli data lena: shelters ki capacity, boats ki list.
- Website ko internet par live karna (Vercel + Render).

---

**Ek line mein pitch:** *AEGIS-X baadh ke plan ka flight simulator hai: asli baadh aane se pehle plan ko 500 baar test karta hai, uski kamzori dhoondhta hai, live sarkari alerts dekhta hai, aur faisla insaan ke haath mein chhodta hai.*
