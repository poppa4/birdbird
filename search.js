/* Birdbird – alltid synlig søk og spørsmål.
   1) Lokalt: sider og seksjoner (EN/NO-nøkkelord) og små utregninger, øyeblikkelig og uten AI.
   2) AI som reserve: svarer kort og peker til riktig side. */
(function(){
'use strict';
const no=()=>document.documentElement.lang==='nb';
const L=o=>no()?o.no:o.en;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* ---------- innhold ---------- */
const P=(u,en,nb,k,den,dno)=>({u,t:{en,no:nb},k:(k+' '+en+' '+nb).toLowerCase(),d:{en:den||'',no:dno||''}});
const IDX=[
 P('tunnel.html','Wind tunnel','Vindtunnel','aerofoil section and stall profilsnitt og stall 3d wind tunnel 3d-vindtunnel things to try prøv dette wingtip vortices vingetippvirvler ground effect bakkeeffekt','Virtual Lab · Principles of flight','Virtual Lab · Aerodynamikk'),
 P('tunnel.html#profil','Aerofoil section and stall','Profilsnitt og stall','aerofoil section and stall profilsnitt og stall','Wind tunnel','Vindtunnel'),
 P('tunnel.html#tunnel','3D wind tunnel','3D-vindtunnel','3d wind tunnel 3d-vindtunnel','Wind tunnel','Vindtunnel'),
 P('tunnel.html#try','Things to try','Prøv dette','things to try prøv dette','Wind tunnel','Vindtunnel'),
 P('tunnel.html#wake','Wingtip vortices','Vingetippvirvler','wingtip vortices vingetippvirvler','Wind tunnel','Vindtunnel'),
 P('tunnel.html#ground','Ground effect','Bakkeeffekt','ground effect bakkeeffekt','Wind tunnel','Vindtunnel'),
 P('stability.html','Stability, controls and load factor','Stabilitet, ror og lastfaktor','cg and balance cg og balanse static stability statisk stabilitet dynamic stability dynamisk stabilitet load factor and v-n lastfaktor og v-n flight controls flykontroller in the aircraft i flyet neutral point nøytralpunkt stick force per g manoeuvre point dutch roll spiral phugoid fugoide short period gust load vindkast buffet coffin corner adverse yaw tabs flutter aileron reversal ths trim','Virtual Lab · Principles of flight','Virtual Lab · Aerodynamikk'),
 P('stability.html#cg','CG and balance','CG og balanse','cg and balance cg og balanse tail download halelast stall speed steilefart static margin statisk margin stick force per g stikkekraft per g cg envelope cg-konvolutt','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('stability.html#static','Static stability','Statisk stabilitet','static stability statisk stabilitet neutral point nøytralpunkt stick free fri stikke cm alpha','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('stability.html#dynamic','Dynamic stability','Dynamisk stabilitet','dynamic stability dynamisk stabilitet short period kortperiode phugoid fugoide dutch roll spiral yaw damper girdemper','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('stability.html#vn','Load factor and V-n','Lastfaktor og V-n','load factor and v-n lastfaktor og v-n va vb gust vindkast turbulence speed turbulensfart buffet coffin corner','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('stability.html#controls','Flight controls','Flykontroller','flight controls flykontroller adverse yaw negativ giring tabs aerodynamic balance mass balance flutter aileron reversal balanserorreversering ths spoilers','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('stability.html#ops','In the aircraft','I flyet','in the aircraft i flyet loadsheet lasteark takeoff trim mistrim feiltrim turbulence speed','Stability, controls and load factor','Stabilitet, ror og lastfaktor'),
 P('propeller.html','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter','asymmetric thrust asymmetrisk skyv vmcg and vmca vmcg og vmca failure after v1 motorstans etter v1 in the aircraft i flyet','Virtual Lab · Principles of flight','Virtual Lab · Aerodynamikk'),
 P('propeller.html#single','Asymmetric thrust','Asymmetrisk skyv','asymmetric thrust asymmetrisk skyv','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
 P('propeller.html#twin','VMCG and VMCA','VMCG og VMCA','vmcg and vmca vmcg og vmca','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
 P('propeller.html#a320','Failure after V1','Motorstans etter V1','failure after v1 motorstans etter v1','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
 P('highspeed.html','High-speed flight and drag','Høyfart og motstand','drag and speed stability motstand og fartsstabilitet mach and compressibility mach og kompressibilitet buffet boundary buffetgrense the swept wing pilvingen upset recovery upset recovery in the aircraft i flyet','Virtual Lab · Principles of flight','Virtual Lab · Aerodynamikk'),
 P('highspeed.html#drag','Drag and speed stability','Motstand og fartsstabilitet','drag and speed stability motstand og fartsstabilitet','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#mach','Mach and compressibility','Mach og kompressibilitet','mach and compressibility mach og kompressibilitet','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#coffin','Buffet boundary','Buffetgrense','buffet boundary buffetgrense','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#swept','The swept wing','Pilvingen','the swept wing pilvingen','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#upset','Upset recovery','Upset recovery','upset recovery upset recovery','High-speed flight and drag','Høyfart og motstand'),
 P('altimetry.html','Pressure and altitude','Trykk og høyde','why the altimeter lies hvorfor høydemåleren lyver altimeter settings høydemålerinnstillinger density altitude tetthetshøyde cold temperature kulde','Virtual Lab · Atmosphere and air data','Virtual Lab · Atmosfære og luftdata'),
 P('altimetry.html#xs','Why the altimeter lies','Hvorfor høydemåleren lyver','why the altimeter lies hvorfor høydemåleren lyver','Pressure and altitude','Trykk og høyde'),
 P('altimetry.html#set','Altimeter settings','Høydemålerinnstillinger','altimeter settings høydemålerinnstillinger','Pressure and altitude','Trykk og høyde'),
 P('altimetry.html#da','Density altitude','Tetthetshøyde','density altitude tetthetshøyde','Pressure and altitude','Trykk og høyde'),
 P('altimetry.html#cold','Cold temperature','Kulde','cold temperature kulde','Pressure and altitude','Trykk og høyde'),
 P('pitot.html','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart','the lab labben what each fault does hva hver feil gjør wind and weather vind og vær unreliable airspeed upålitelig fart','Virtual Lab · Atmosphere and air data','Virtual Lab · Atmosfære og luftdata'),
 P('pitot.html#lab','The lab','Labben','the lab labben','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart'),
 P('pitot.html#table','What each fault does','Hva hver feil gjør','what each fault does hva hver feil gjør','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart'),
 P('pitot.html#wind','Wind and weather','Vind og vær','wind and weather vind og vær','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart'),
 P('pitot.html#uas','Unreliable airspeed','Upålitelig fart','unreliable airspeed upålitelig fart','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart'),
 P('clouds.html','Clouds, stability and fog','Skyer, stabilitet og tåke','lift a parcel løft en luftpakke fog overnight tåke gjennom natten in the aircraft i flyet','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('clouds.html#lift','Lift a parcel','Løft en luftpakke','lift a parcel løft en luftpakke','Clouds, stability and fog','Skyer, stabilitet og tåke'),
 P('clouds.html#fog','Fog overnight','Tåke gjennom natten','fog overnight tåke gjennom natten','Clouds, stability and fog','Skyer, stabilitet og tåke'),
 P('fronts.html','Pressure, fronts and wind','Trykk, fronter og vind','fly through a front fly gjennom en front the fronts side by side frontene side om side highs and lows høytrykk og lavtrykk why the wind blows hvorfor vinden blåser local winds lokale vinder air masses, jet streams and charts luftmasser, jetstrømmer og kart global circulation global sirkulasjon','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('fronts.html#lab','Fly through a front','Fly gjennom en front','fly through a front fly gjennom en front','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#table','The fronts side by side','Frontene side om side','the fronts side by side frontene side om side','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#stab','Highs and lows','Høytrykk og lavtrykk','highs and lows høytrykk og lavtrykk','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#forces','Why the wind blows','Hvorfor vinden blåser','why the wind blows hvorfor vinden blåser','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#local','Local winds','Lokale vinder','local winds lokale vinder','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#press','Air masses, jet streams and charts','Luftmasser, jetstrømmer og kart','air masses, jet streams and charts luftmasser, jetstrømmer og kart','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('fronts.html#global','Global circulation','Global sirkulasjon','global circulation global sirkulasjon','Pressure, fronts and wind','Trykk, fronter og vind'),
 P('storms.html','Thunderstorms and weather radar','Tordenvær og værradar','the life of a cb livet til en cb around a cell rundt en celle microburst on final mikroburst på finalen weather radar værradar types and warnings typer og varsler','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('storms.html#life','The life of a CB','Livet til en CB','the life of a cb livet til en cb','Thunderstorms and weather radar','Tordenvær og værradar'),
 P('storms.html#radar','Around a cell','Rundt en celle','around a cell rundt en celle','Thunderstorms and weather radar','Tordenvær og værradar'),
 P('storms.html#shear','Microburst on final','Mikroburst på finalen','microburst on final mikroburst på finalen','Thunderstorms and weather radar','Tordenvær og værradar'),
 P('storms.html#wxr','Weather radar','Værradar','weather radar værradar','Thunderstorms and weather radar','Tordenvær og værradar'),
 P('storms.html#types','Types and warnings','Typer og varsler','types and warnings typer og varsler','Thunderstorms and weather radar','Tordenvær og værradar'),
 P('hazards.html','Icing, turbulence and de-icing','Ising, turbulens og avising','icing ising de-icing avising turbulence turbulens wake turbulence vaketurbulens other hazards andre farer','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('hazards.html#icing','Icing','Ising','icing ising','Icing, turbulence and de-icing','Ising, turbulens og avising'),
 P('hazards.html#deice','De-icing','Avising','de-icing avising','Icing, turbulence and de-icing','Ising, turbulens og avising'),
 P('hazards.html#turb','Turbulence','Turbulens','turbulence turbulens','Icing, turbulence and de-icing','Ising, turbulens og avising'),
 P('hazards.html#wake','Wake turbulence','Vaketurbulens','wake turbulence vaketurbulens','Icing, turbulence and de-icing','Ising, turbulens og avising'),
 P('hazards.html#more','Other hazards','Andre farer','other hazards andre farer','Icing, turbulence and de-icing','Ising, turbulens og avising'),
 P('engines.html','The turbofan engine','Turbofanmotoren','take it apart ta den fra hverandre start and spool-up start og spoling flat rating and flex flat rating og flex a320 engines a320-motorer in the cockpit i cockpit','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('engines.html#eng','Take it apart','Ta den fra hverandre','take it apart ta den fra hverandre','The turbofan engine','Turbofanmotoren'),
 P('engines.html#start','Start and spool-up','Start og spoling','start and spool-up start og spoling','The turbofan engine','Turbofanmotoren'),
 P('engines.html#rating','Flat rating and FLEX','Flat rating og FLEX','flat rating and flex flat rating og flex','The turbofan engine','Turbofanmotoren'),
 P('engines.html#cmp','A320 engines','A320-motorer','a320 engines a320-motorer','The turbofan engine','Turbofanmotoren'),
 P('jetsystems.html','Jet transport systems','Systemer på jetfly','hydraulics hydraulikk fly-by-wire fly-by-wire electrics elektrisk gear and brakes understell og bremser fuel, bleed and fire drivstoff, bleed og brann in the aircraft i flyet','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('jetsystems.html#hyd','Hydraulics','Hydraulikk','hydraulics hydraulikk','Jet transport systems','Systemer på jetfly'),
 P('jetsystems.html#fbw','Fly-by-wire','Fly-by-wire','fly-by-wire fly-by-wire','Jet transport systems','Systemer på jetfly'),
 P('jetsystems.html#elec','Electrics','Elektrisk','electrics elektrisk','Jet transport systems','Systemer på jetfly'),
 P('jetsystems.html#gear','Gear and brakes','Understell og bremser','gear and brakes understell og bremser','Jet transport systems','Systemer på jetfly'),
 P('jetsystems.html#fuelbleed','Fuel, bleed and fire','Drivstoff, bleed og brann','fuel, bleed and fire drivstoff, bleed og brann','Jet transport systems','Systemer på jetfly'),
 P('pressurisation.html','Pressurisation and hypoxia','Trykkabin og hypoksi','cabin altitude kabinhøyde decompression dekompresjon hypoxia hypoksi in the aircraft i flyet','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('pressurisation.html#cabin','Cabin altitude','Kabinhøyde','cabin altitude kabinhøyde','Pressurisation and hypoxia','Trykkabin og hypoksi'),
 P('pressurisation.html#decomp','Decompression','Dekompresjon','decompression dekompresjon','Pressurisation and hypoxia','Trykkabin og hypoksi'),
 P('pressurisation.html#hypoxia','Hypoxia','Hypoksi','hypoxia hypoksi','Pressurisation and hypoxia','Trykkabin og hypoksi'),
 P('gyros.html','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS','magnetic compass magnetkompass gyroscopes gyroskoper from gyros to adirs fra gyro til adirs in the aircraft i flyet','Virtual Lab · Instruments and automation','Virtual Lab · Instrumenter og automatikk'),
 P('gyros.html#compass','Magnetic compass','Magnetkompass','magnetic compass magnetkompass','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS'),
 P('gyros.html#gyro','Gyroscopes','Gyroskoper','gyroscopes gyroskoper','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS'),
 P('gyros.html#irs','From gyros to ADIRS','Fra gyro til ADIRS','from gyros to adirs fra gyro til adirs','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS'),
 P('autoflight.html','Autoflight and warnings','Autoflight og varsling','reading the fma lese fma-en mode traps modusfeller tcas tcas egpws egpws in the aircraft i flyet','Virtual Lab · Instruments and automation','Virtual Lab · Instrumenter og automatikk'),
 P('autoflight.html#fma','Reading the FMA','Lese FMA-en','reading the fma lese fma-en','Autoflight and warnings','Autoflight og varsling'),
 P('autoflight.html#traps','Mode traps','Modusfeller','mode traps modusfeller','Autoflight and warnings','Autoflight og varsling'),
 P('autoflight.html#tcas','TCAS','TCAS','tcas tcas','Autoflight and warnings','Autoflight og varsling'),
 P('autoflight.html#gpws','EGPWS','EGPWS','egpws egpws','Autoflight and warnings','Autoflight og varsling'),
 P('massbalance.html','Mass and balance','Masse og balanse','masses and limits masser og grenser centre of gravity tyngdepunkt load sheet lasteark in the aircraft i flyet','Virtual Lab · Mass, balance and performance','Virtual Lab · Masse, balanse og ytelse'),
 P('massbalance.html#masses','Masses and limits','Masser og grenser','masses and limits masser og grenser','Mass and balance','Masse og balanse'),
 P('massbalance.html#cg','Centre of gravity','Tyngdepunkt','centre of gravity tyngdepunkt','Mass and balance','Masse og balanse'),
 P('massbalance.html#loadsheet','Load sheet','Lasteark','load sheet lasteark','Mass and balance','Masse og balanse'),
 P('performance.html','Performance','Ytelse','take-off and v1 start og v1 take-off mass limits begrensninger for startvekt climb and cruise stigning og cruise engine failure en route motorstans underveis landing distance landingsdistanse in the aircraft i flyet','Virtual Lab · Mass, balance and performance','Virtual Lab · Masse, balanse og ytelse'),
 P('performance.html#takeoff','Take-off and V1','Start og V1','take-off and v1 start og v1','Performance','Ytelse'),
 P('performance.html#limits','Take-off mass limits','Begrensninger for startvekt','take-off mass limits begrensninger for startvekt','Performance','Ytelse'),
 P('performance.html#climb','Climb and cruise','Stigning og cruise','climb and cruise stigning og cruise','Performance','Ytelse'),
 P('performance.html#enroute','Engine failure en route','Motorstans underveis','engine failure en route motorstans underveis','Performance','Ytelse'),
 P('performance.html#landing','Landing distance','Landingsdistanse','landing distance landingsdistanse','Performance','Ytelse'),
 P('gennav.html','General navigation','Generell navigasjon','wind triangle vindtrekanten 1 in 60 1 av 60 earth and directions jorden og retninger chart projections kartprojeksjoner time tid pet and pnr pet og pnr in the aircraft i flyet','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('gennav.html#triangle','Wind triangle','Vindtrekanten','wind triangle vindtrekanten','General navigation','Generell navigasjon'),
 P('gennav.html#sixty','1 in 60','1 av 60','1 in 60 1 av 60','General navigation','Generell navigasjon'),
 P('gennav.html#earth','Earth and directions','Jorden og retninger','earth and directions jorden og retninger','General navigation','Generell navigasjon'),
 P('gennav.html#charts','Chart projections','Kartprojeksjoner','chart projections kartprojeksjoner','General navigation','Generell navigasjon'),
 P('gennav.html#time','Time','Tid','time tid','General navigation','Generell navigasjon'),
 P('gennav.html#pet','PET and PNR','PET og PNR','pet and pnr pet og pnr','General navigation','Generell navigasjon'),
 P('radionav.html','Radio navigation and radar','Radionavigasjon og radar','move the aircraft flytt flyet where am i? hvor er jeg? radar and ads-b radar og ads-b what to remember det du må huske','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('radionav.html#lab','Move the aircraft','Flytt flyet','move the aircraft flytt flyet','Radio navigation and radar','Radionavigasjon og radar'),
 P('radionav.html#chal','Where am I?','Hvor er jeg?','where am i? hvor er jeg?','Radio navigation and radar','Radionavigasjon og radar'),
 P('radionav.html#radar','Radar and ADS-B','Radar og ADS-B','radar and ads-b radar og ads-b','Radio navigation and radar','Radionavigasjon og radar'),
 P('radionav.html#notes','What to remember','Det du må huske','what to remember det du må huske','Radio navigation and radar','Radionavigasjon og radar'),
 P('gnss.html','GNSS and RNAV','GNSS og RNAV','satellite geometry satellittgeometri waypoints and turns veipunkter og svinger specifications and minima spesifikasjoner og minima threats trusler','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('gnss.html#sat','Satellite geometry','Satellittgeometri','satellite geometry satellittgeometri','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#wp','Waypoints and turns','Veipunkter og svinger','waypoints and turns veipunkter og svinger','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#spec','Specifications and minima','Spesifikasjoner og minima','specifications and minima spesifikasjoner og minima','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#risk','Threats','Trusler','threats trusler','GNSS and RNAV','GNSS og RNAV'),
 P('holding.html','Holding','Holding','anatomy of a hold oppbygningen av en holding entry trainer entry-trener wind correction vindkorreksjon entry drill entry-drill','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('holding.html#anatomy','Anatomy of a hold','Oppbygningen av en holding','anatomy of a hold oppbygningen av en holding','Holding','Holding'),
 P('holding.html#entry','Entry trainer','Entry-trener','entry trainer entry-trener','Holding','Holding'),
 P('holding.html#wind','Wind correction','Vindkorreksjon','wind correction vindkorreksjon','Holding','Holding'),
 P('holding.html#drill','Entry drill','Entry-drill','entry drill entry-drill','Holding','Holding'),
 P('approach.html','Instrument approach and ILS','Instrumentinnflyging og ILS','needles and geometry nåler og geometri rate of descent sinkrate inside the ils signal inne i ils-signalet segments and minima segmenter og minima','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('approach.html#lab','Needles and geometry','Nåler og geometri','needles and geometry nåler og geometri','Instrument approach and ILS','Instrumentinnflyging og ILS'),
 P('approach.html#rod','Rate of descent','Sinkrate','rate of descent sinkrate','Instrument approach and ILS','Instrumentinnflyging og ILS'),
 P('approach.html#ils','Inside the ILS signal','Inne i ILS-signalet','inside the ils signal inne i ils-signalet','Instrument approach and ILS','Instrumentinnflyging og ILS'),
 P('approach.html#seg','Segments and minima','Segmenter og minima','segments and minima segmenter og minima','Instrument approach and ILS','Instrumentinnflyging og ILS'),
 P('flightplanning.html','Flight planning and fuel','Flyplanlegging og drivstoff','fuel make-up drivstoffsammensetning alternates and minima alternativer og minima in-flight fuel drivstoff under flyging tankering tankering level and cost index høyde og kostindeks atc flight plan atc-færdselsplan in the aircraft i flyet','Virtual Lab · Flight planning','Virtual Lab · Flyplanlegging'),
 P('flightplanning.html#fuel','Fuel make-up','Drivstoffsammensetning','fuel make-up drivstoffsammensetning','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('flightplanning.html#alternates','Alternates and minima','Alternativer og minima','alternates and minima alternativer og minima','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('flightplanning.html#inflight','In-flight fuel','Drivstoff under flyging','in-flight fuel drivstoff under flyging','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('flightplanning.html#tanker','Tankering','Tankering','tankering tankering','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('flightplanning.html#cruise','Level and cost index','Høyde og kostindeks','level and cost index høyde og kostindeks','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('flightplanning.html#atc','ATC flight plan','ATC-færdselsplan','atc flight plan atc-færdselsplan','Flight planning and fuel','Flyplanlegging og drivstoff'),
 P('orientation.html','Spatial orientation','Romlig orientering','the three senses de tre sansene inner ear simulator indre øre-simulator trainer trener approach illusions illusjoner på innflyging other illusions andre illusjoner','Virtual Lab · Human performance','Virtual Lab · Menneskelige faktorer'),
 P('orientation.html#senses','The three senses','De tre sansene','the three senses de tre sansene','Spatial orientation','Romlig orientering'),
 P('orientation.html#ear','Inner ear simulator','Indre øre-simulator','inner ear simulator indre øre-simulator','Spatial orientation','Romlig orientering'),
 P('orientation.html#trainer','Trainer','Trener','trainer trener','Spatial orientation','Romlig orientering'),
 P('orientation.html#approach','Approach illusions','Illusjoner på innflyging','approach illusions illusjoner på innflyging','Spatial orientation','Romlig orientering'),
 P('orientation.html#other','Other illusions','Andre illusjoner','other illusions andre illusjoner','Spatial orientation','Romlig orientering'),
 P('humanperf.html','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet','information processing informasjonsbehandling workload arbeidsbelastning fatigue tretthet threat and error trusler og feil vision syn in the aircraft i flyet','Virtual Lab · Human performance','Virtual Lab · Menneskelige faktorer'),
 P('humanperf.html#info','Information processing','Informasjonsbehandling','information processing informasjonsbehandling','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#workload','Workload','Arbeidsbelastning','workload arbeidsbelastning','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#fatigue','Fatigue','Tretthet','fatigue tretthet','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#tem','Threat and error','Trusler og feil','threat and error trusler og feil','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#vision','Vision','Syn','vision syn','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('simcheck.html','A320 simulator assessment','A320 simulatortest','sim assessment simulator test recruitment airline a320 raw data pf pm callouts steep turns slow flight go-around','Preparing for an airline simulator assessment','Forberedelse til simulatortest hos flyselskap'),
 P('typerating.html','Type rating trainer: King Air B200','Typeratingtrener: King Air B200','type rating typerating b200 king air be20 pt6a systems questions oral exam flashcards','Study plan, cockpit simulators, 320 questions and an oral exam','Studieplan, cockpitsimulatorer, 320 spørsmål og muntlig eksamen'),
 P('prep.html','Briefing pack','Briefingpakke','prep preparation forberedelse pc skill test proficiency check checkride book hefte print','Your whole flight preparation in one booklet','Hele flyforberedelsen i ett hefte'),
 P('prep.html#s-minima','Planning minima and alternates','Planleggingsminima og alternativer','minima alternate alternativ alternates destination nco ncc cat 0 1 2 planning planlegging dh mda','How many destination alternates, and their minima','Hvor mange destinasjonsalternativer, og minima'),
 P('prep.html#s-mb','Mass and balance','Masse og balanse','mass balance weight cg envelope tyngdepunkt vekt da42 w&b loading','Moments, CG and the envelope','Moment, tyngdepunkt og konvolutt'),
 P('prep.html#s-rwy','Runway performance','Baneytelse','runway performance takeoff landing distance tora lda toda asda crosswind sidevind pressure altitude density','Distances, factors, wind components','Distanser, faktorer, vindkomponenter'),
 P('prep.html#s-fuel','Fuel planning','Drivstoffplanlegging','fuel drivstoff reserve contingency taxi trip final reserve endurance','Trip, contingency, alternate and reserve','Trip, contingency, alternativ og reserve'),
 P('prep.html#s-grad','Climb gradients','Stigegradienter','climb gradient stigegradient sid missed approach % ft/nm oei','Required gradient vs what you can do','Krevd gradient mot det flyet klarer'),
 P('prep.html#s-risk','Risk assessment','Risikovurdering','risk risiko assessment pave imsafe','A quick risk check before you go','En rask risikosjekk før du drar'),
 P('prep.html#s-rcf','Radio failure','Radiosvikt','radio failure rcf comm loss 7600 lost communication','What to do if the radio fails','Hva du gjør ved radiosvikt'),
 P('route.html','Route Explorer','Route Explorer','route explorer route profile ruteprofil route string rutestreng foreflight import metar taf cross-section tverrsnitt sideprofil terrain terreng map kart fix waypoint toc tod vertical profile','Build the route and see it from the side','Bygg ruten og se den fra siden'),
 P('route.html','Draw the profile yourself','Tegn profilen selv','draw tegn goodnotes sketch blank sheet ark','A blank profile sheet to draw on','Et tomt profilark å tegne på'),
 P('planning.html','Navigation log','Navigasjonslogg','nav log navlog wind triangle vindtrekant heading groundspeed wca eta','Headings, times and fuel per leg','Kurser, tider og drivstoff per etappe'),
 P('weather.html','METAR and TAF decoder','METAR og TAF','metar taf weather vær decode avkode ceiling skybase cavok','Paste a report and read it line by line','Lim inn en rapport og les den linje for linje'),
 P('sheets.html','Kneeboard sheets','Kneeboard-ark','kneeboard ofp sheet ark print skriv ut vfr ifr','Blank A5 sheets for paper or GoodNotes','Tomme A5-ark for papir eller GoodNotes'),
 P('essentials.html','VFR and IFR essentials','Det viktigste i VFR og IFR','vfr ifr vmc minimum height minstehøyde levels flygenivå semicircular sera essentials airspace luftrom klasse class','The numbers you use on every flight','Tallene du bruker på hver tur'),
 P('essentials.html','VMC minima','VMC-minima','vmc sikt visibility cloud distance avstand skyer klasse g class g 5 km 1500 m sera.5001','Visibility and distance from cloud by airspace','Sikt og avstand til skyer etter luftrom'),
 P('lab.html','Virtual Lab (all labs)','Virtual Lab (alle labber)','lab labs virtual oversikt overview theory teori','Every interactive model, grouped by subject','Alle interaktive modeller, sortert etter fag'),
 P('radio.html','Gate to gate','Gate to gate','gate to gate radio atc phraseology fraseologi checklist sjekkliste flow startup taxi clearance klarering da42','A whole trip in order with an AI controller','En hel tur i rekkefølge med AI-flygeleder'),
 P('briefing.html','Briefings (TSADMM)','Briefinger (TSADMM)','briefing departure brief approach brief tsadmm avgangsbrief innflygingsbrief plate','Brief a departure or approach and get a score','Brief en avgang eller innflyging og få poeng'),
 P('radio-drills.html','Radio drills','Radiodriller','radio drill readback tilbakelesing atc calls','Short radio exercises','Korte radioøvelser'),
 P('fi.html','Flight Intelligence','Flight Intelligence','flight intelligence instructor instruktør afm poh fcom qrh sop aircraft systems systemer limitations begrensninger oral exam muntlig scenario revision repetisjon documents dokumenter','Your own instructor that answers from your documents','Din egen instruktør som svarer fra dokumentene dine'),
 P('checkride.html','Check preparation','Kontrollforberedelse','checkride pc skill test oral muntlig examiner eksaminator easa questions spørsmål','The instructor questions you like an examiner, from your documents','Instruktøren spør deg ut som en eksaminator, fra dokumentene dine'),
 P('cockpit.html','Glass cockpit simulator','Glass cockpit-simulator','g1000 simulator cockpit pfd mfd autopilot da42 ils take-off avgang','Fly the DA42 with a G1000-style panel','Fly DA42 med et G1000-lignende panel'),
 P('profile.html','Your progress','Din progresjon','profile profil progress progresjon rank rang xp','Rank, points and what to do next','Rang, poeng og hva du bør gjøre nå')
];
/* ---------- utregninger ---------- */
const num=s=>parseFloat(String(s).replace(',','.'));
const r0=v=>Math.round(v), r1=v=>Math.round(v*10)/10;
function calc(q){ const t=' '+q.toLowerCase().replace(/,/g,'.')+' '; let m;
  // sidevind: 270/15(G25) rwy 24
  if((m=t.match(/(\d{3})\s*[\/@]\s*(\d{1,3})(?:g(\d{1,3}))?(?:\s*kt)?[^\d]*(?:rwy|runway|bane|rw)?\s*(\d{1,2})[lrc]?\b/))||(m=t.match(/(\d{3})(\d{2,3})(?:g(\d{2,3}))?kt[^\d]*(\d{1,2})[lrc]?\b/))){ const wd=+m[1], ws=+m[2], gs=m[3]?+m[3]:null, rw=+m[4]*10; if(wd<=360&&rw<=360){ const a=(wd-rw)*Math.PI/180, hw=ws*Math.cos(a), xw=ws*Math.sin(a), xg=gs?Math.abs(gs*Math.sin(a)):null;
    return {h:L({en:'Wind components',no:'Vindkomponenter'}),v:`${hw>=0?L({en:'Headwind',no:'Motvind'}):L({en:'Tailwind',no:'Medvind'})} ${r0(Math.abs(hw))} kt · ${L({en:'crosswind',no:'sidevind'})} ${r0(Math.abs(xw))} kt ${xw>0?L({en:'from the right',no:'fra høyre'}):xw<0?L({en:'from the left',no:'fra venstre'}):''}${xg?` (${L({en:'gusts',no:'kast'})} ${r0(xg)})`:''}`,u:'prep.html#s-rwy'}; } }
  // sinkrate: 3° 120 kt
  if((m=t.match(/(\d(?:\.\d)?)\s*(?:°|deg|grader|degree)\D{0,12}?(\d{2,3})\s*(?:kt|knop)/))||(m=t.match(/(?:rod|sinkrate|rate of descent|descent)\D{0,8}(\d{2,3})\s*(?:kt)?/))&&!t.match(/%/)){ const ang=m[2]?num(m[1]):3, gs=m[2]?+m[2]:+m[1]; if(gs>=40&&gs<=400&&ang>0&&ang<10){ const f=Math.tan(ang*Math.PI/180)*6076/60;
    return {h:L({en:`Rate of descent on ${ang}°`,no:`Sinkrate på ${ang}°`}),v:`${r0(gs*f/10)*10} ft/min · ${r0(Math.tan(ang*Math.PI/180)*6076)} ft/NM`,u:'approach.html#rod'}; } }
  // gradient: 3.3 % 120 kt
  if((m=t.match(/(\d{1,2}(?:\.\d+)?)\s*%\D{0,10}(\d{2,3})\s*kt/))){ const g=num(m[1]), gs=+m[2]; return {h:L({en:`Climb gradient ${g} %`,no:`Stigegradient ${g} %`}),v:`${r0(g*60.76)} ft/NM · ${r0(g*gs*1.013/10)*10} ft/min ${L({en:'at',no:'ved'})} ${gs} kt`,u:'prep.html#s-grad'}; }
  // trykkhøyde / tetthetshøyde: elev 1500 qnh 1003 (t 25)
  if((m=t.match(/(?:elev|elevation|høyde|pa|alt)\D{0,4}(-?\d{1,5})\D{0,12}qnh\D{0,3}(\d{3,4})(?:\D{1,10}(?:t|temp|oat)\D{0,3}(-?\d{1,2}))?/))||(m=t.match(/qnh\D{0,3}(\d{3,4})\D{0,12}(?:elev|elevation|høyde|alt)\D{0,4}(-?\d{1,5})(?:\D{1,10}(?:t|temp|oat)\D{0,3}(-?\d{1,2}))?/))){ let el=+m[1], q=+m[2]; if(q<900){ [el,q]=[q,el]; } if(q>900&&q<1100){ const pa=el+(1013-q)*30; let v=`${L({en:'Pressure altitude',no:'Trykkhøyde'})} ${r0(pa)} ft`; if(m[3]!=null){ const isa=15-2*pa/1000, da=pa+120*(+m[3]-isa); v+=` · ${L({en:'density altitude',no:'tetthetshøyde'})} ≈ ${r0(da/10)*10} ft (ISA ${r1(isa)} °C)`; } return {h:L({en:'Pressure altitude',no:'Trykkhøyde'}),v,u:'altimetry.html'}; } }
  // skybase: temp 16 dew 11 / 16/11
  if((m=t.match(/(?:cloud base|skybase|spread|spredning)\D{0,6}(-?\d{1,2})\D{1,8}(-?\d{1,2})/))){ const a=+m[1], b=+m[2]; return {h:L({en:'Cumulus cloud base',no:'Cumulus-skybase'}),v:`(${a} − ${b}) × 400 ≈ ${r0(Math.max(0,a-b)*400/100)*100} ft AGL`,u:'fronts.html#stab'}; }
  // tid: 60 nm 120 kt
  if((m=t.match(/(\d{1,4}(?:\.\d)?)\s*nm\D{0,8}(\d{2,3})\s*kt/))){ const d=num(m[1]), gs=+m[2], mn=d/gs*60; return {h:L({en:'Time',no:'Tid'}),v:`${Math.floor(mn/60)}:${String(r0(mn%60)).padStart(2,'0')} (${r0(mn)} min)`,u:'planning.html'}; }
  // enheter
  const cv=[[/(-?\d+(?:\.\d+)?)\s*(?:ft|fot|feet)\b/, v=>`${r0(v*0.3048)} m`,'ft → m'],[/(-?\d+(?:\.\d+)?)\s*(?:m|meter)\b(?!\w)/, v=>`${r0(v/0.3048)} ft`,'m → ft'],[/(\d+(?:\.\d+)?)\s*(?:kt|knop|knots)\b/, v=>`${r0(v*1.852)} km/h · ${r0(v*0.5144)} m/s`,'kt'],
   [/(\d+(?:\.\d+)?)\s*km\/h/, v=>`${r0(v/1.852)} kt`,'km/h → kt'],[/(\d{3,4}(?:\.\d+)?)\s*hpa/, v=>`${(v*0.02953).toFixed(2)} inHg`,'hPa → inHg'],[/(\d{2}\.\d{1,2})\s*(?:inhg|in)\b/, v=>`${r0(v/0.02953)} hPa`,'inHg → hPa'],
   [/(\d+(?:\.\d+)?)\s*(?:nm|nautical)\b/, v=>`${r1(v*1.852)} km`,'NM → km'],[/(\d+(?:\.\d+)?)\s*km\b/, v=>`${r1(v/1.852)} NM`,'km → NM'],[/(\d+(?:\.\d+)?)\s*(?:usg|us gal|gal)\b/, v=>`${r1(v*3.785)} L`,'USG → L'],[/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)\b/, v=>`${r1(v/3.785)} USG`,'L → USG'],
   [/(\d+(?:\.\d+)?)\s*(?:kg)\b/, v=>`${r0(v*2.2046)} lb`,'kg → lb'],[/(\d+(?:\.\d+)?)\s*(?:lb|lbs)\b/, v=>`${r0(v/2.2046)} kg`,'lb → kg'],[/(-?\d+(?:\.\d+)?)\s*°?\s*f\b/, v=>`${r1((v-32)/1.8)} °C`,'°F → °C']];
  for(const [re,f,lab] of cv){ const mm=t.match(re); if(mm&&t.trim().split(/\s+/).length<=5) return {h:lab,v:f(num(mm[1])),u:null}; }
  return null; }
/* ---------- søk ---------- */
const STOP=new Set(['kt','nm','ft','m','qnh','elev','elevation','rwy','runway','bane','t','temp','oat','deg','the','a','an','is','what','how','why','hva','hvordan','hvorfor','er','en','et','og','and','of','to','i','på','in','for','med','with','min','hpa','kg','lb','usg','l']);
const WORDS=IDX.map(e=>new Set(e.k.split(/[^\p{L}\p{N}]+/u).filter(Boolean)));
function score(q){ const w=q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1&&!STOP.has(x)&&!/^\d+$/.test(x));
  if(!w.length) return []; return IDX.map((e,i)=>{ let s=0; w.forEach(x=>{ if(WORDS[i].has(x)) s+=3; else if([...WORDS[i]].some(v=>v.startsWith(x))) s+=x.length>=4?2:1; else if(x.length>=4&&e.k.includes(x)) s+=1; }); return {e,s}; }).filter(x=>x.s>=2).sort((a,b)=>b.s-a.s).slice(0,5); }
/* ---------- UI ---------- */
const css=`.nsearch{position:relative;z-index:25;margin:0 calc(-1*max(20px,env(safe-area-inset-right,0px))) 0 calc(-1*max(20px,env(safe-area-inset-left,0px)));padding:8px max(20px,env(safe-area-inset-left,0px));background:#F3F5F3;border-bottom:1px solid #DCE3E4}
.nsearch .in{display:flex;align-items:center;gap:10px;max-width:1320px;margin:0 auto;background:#fff;border:1px solid #C9D2D5;border-radius:6px;padding:0 12px;transition:border-color .15s,box-shadow .15s}
.nsearch .in:focus-within{border-color:#9A1E68;box-shadow:0 0 0 3px rgba(154,30,104,.12)}
.nsearch svg{flex:0 0 18px;width:18px;height:18px;color:#7D8B95}
.nsearch input{flex:1;border:0;outline:0;font:inherit;font-size:15px;padding:10px 0;background:transparent;color:#13202A;min-width:0}
.nsearch .hint{display:none}
@media (max-width:700px){.nsearch .hint{display:none}}
.nsearch .res{position:absolute;left:max(20px,env(safe-area-inset-left,0px));right:max(20px,env(safe-area-inset-right,0px));max-width:1320px;margin:6px auto 0;background:#fff;border:1px solid #C9D2D5;border-radius:6px;box-shadow:0 10px 28px rgba(19,32,42,.14);overflow:hidden}
.nsearch .res[hidden]{display:none}
.nsearch .it{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;text-decoration:none;color:#13202A;border-top:1px solid #EEF1EF;cursor:pointer}
.nsearch .it:first-child{border-top:0}.nsearch .it.on,.nsearch .it:hover{background:#F6EDF2}
.nsearch .it b{font-weight:600}.nsearch .it small{color:#4C5B66;font-size:13px}
.nsearch .calc{background:#F6F8F6}.nsearch .calc .v{font-family:"IBM Plex Mono",monospace;font-size:14.5px}
.nsearch .ai{padding:12px 14px;font-size:14.5px;line-height:1.5;color:#13202A;border-top:1px solid #EEF1EF}
.nsearch .ai .lk{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}.nsearch .ai .lk a{font-size:13.5px;border:1px solid #C9D2D5;border-radius:14px;padding:3px 10px;text-decoration:none;color:#9A1E68}
.nsearch .sm{font-size:12px;color:#7D8B95}`;
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const EX={en:['crosswind 270/15 rwy 24','alternates NCO','3° 120 kt','holding entry','elev 1500 qnh 1003 t 25','what is an occlusion?'],no:['sidevind 270/15 bane 24','alternativer NCO','3° 120 kt','holding entry','elev 1500 qnh 1003 t 25','hva er en okklusjon?']};
function mount(){ if(document.querySelector('.nsearch')) return; const head=document.querySelector('header.site'); if(!head){ setTimeout(mount,50); return; }
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const box=document.createElement('div'); box.className='nsearch noprint'; box.setAttribute('role','search');
  box.innerHTML=`<div class="in">${ICON}<input type="search" autocomplete="off" spellcheck="false" aria-label="Search or ask"><span class="hint"></span></div><div class="res" hidden></div>`;
  const sub=document.querySelector('nav.trnav'); (sub&&sub.previousElementSibling===head?sub:head).insertAdjacentElement('afterend',box);
  const inp=box.querySelector('input'), res=box.querySelector('.res'), hint=box.querySelector('.hint');
  let exi=0; const ph=()=>{ const ex=EX[no()?'no':'en']; inp.placeholder= innerWidth<640? L({en:'Ask or search…',no:'Spør eller søk …'}) : L({en:'Ask or search anything, e.g. ',no:'Spør eller søk etter hva som helst, f.eks. '})+ex[exi%ex.length]; hint.textContent=L({en:'answers right here',no:'svar rett her'}); };
  ph(); setInterval(()=>{ if(!inp.value&&document.activeElement!==inp){ exi++; ph(); } },4000);
  new MutationObserver(ph).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  let sel=0, items=[], aiCtl=null;
  function draw(){ const q=inp.value.trim(); if(!q){ res.hidden=true; return; }
    const c=calc(q), hits=score(q).filter(x=>!c||x.s>=3); items=[]; let h='';
    if(c){ items.push({u:c.u}); h+=`<div class="it calc" data-i="0"><span><b>${esc(c.h)}</b><br><span class="v">${esc(c.v)}</span></span>${c.u?`<small>${L({en:'Open the tool',no:'Åpne verktøyet'})} →</small>`:''}</div>`; }
    hits.forEach(({e})=>{ items.push({u:e.u}); h+=`<a class="it" data-i="${items.length-1}" href="${e.u}"><span><b>${esc(L(e.t))}</b><br><small>${esc(L(e.d))}</small></span><small>${e.u.split(/[?#]/)[0].replace('.html','')}</small></a>`; });
    items.push({ai:1}); h+=`<div class="it" data-i="${items.length-1}"><span><b>${L({en:'Ask the instructor',no:'Spør instruktøren'})}:</b> ${esc(q)}</span><small>Enter${hits.length||c?' ↵':''}</small></div>`;
    res.innerHTML=h+`<div class="aiw"></div>`; res.hidden=false; sel=0; mark(); }
  function mark(){ res.querySelectorAll('.it').forEach(e=>e.classList.toggle('on',+e.dataset.i===sel)); }
  function go(i){ const it=items[i]; if(!it) return; if(it.ai) return ask(); if(it.u) location.href=it.u; }
  inp.addEventListener('input',draw); inp.addEventListener('focus',()=>{ if(inp.value.trim()) draw(); });
  inp.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(items.length-1,sel+1); mark(); } else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(0,sel-1); mark(); }
    else if(e.key==='Enter'){ e.preventDefault(); const q=inp.value.trim(); if(!q) return; if(/\?$/.test(q)||/^(hva|hvorfor|hvordan|når|what|why|how|when|can|kan|is|er) /i.test(q)) return ask(); go(sel); } else if(e.key==='Escape'){ res.hidden=true; inp.blur(); } });
  res.addEventListener('click',e=>{ const it=e.target.closest('.it'); if(!it) return; const i=+it.dataset.i; if(items[i]&&items[i].ai){ e.preventDefault(); ask(); } else if(it.tagName!=='A'&&items[i]&&items[i].u){ location.href=items[i].u; } });
  document.addEventListener('pointerdown',e=>{ if(!box.contains(e.target)) res.hidden=true; });
  document.addEventListener('keydown',e=>{ if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); inp.focus(); } });
  function ask(){ const q=inp.value.trim(); if(!q) return; res.hidden=true;
    if(window.FI_ASK&&/fi\.html$/.test(location.pathname)){ inp.value=''; window.FI_ASK(q); return; }
    location.href='fi.html?q='+encodeURIComponent(q.slice(0,600))+'#aircraft'; }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
window.NSEARCH={calc,score};
})();
