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
 P('propeller.html#lt','Critical engine on a light twin','Kritisk motor på lett tomotors','critical engine kritisk motor p-factor p-faktor past vmca light twin lett tomotors','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
 P('propeller.html#pwing','Propeller as a wing','Propellen som vinge','propeller blade angle bladvinkel constant speed konstant turtall feather fjæring windmilling vindmølling','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
P('forces.html','Forces in flight','Krefter i flyging','four forces fire krefter lift weight thrust drag løft vekt skyvekraft motstand climb stigning glide glid turn sving load factor lastfaktor vx vy rate one','Aerodynamics','Aerodynamikk'),
P('propeller.html#a320','Failure after V1','Motorstans etter V1','failure after v1 motorstans etter v1','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter'),
 P('highspeed.html','High-speed flight and drag','Høyfart og motstand','drag and speed stability motstand og fartsstabilitet mach and compressibility mach og kompressibilitet buffet boundary buffetgrense the swept wing pilvingen upset recovery upset recovery in the aircraft i flyet','Virtual Lab · Principles of flight','Virtual Lab · Aerodynamikk'),
 P('highspeed.html#drag','Drag and speed stability','Motstand og fartsstabilitet','drag and speed stability motstand og fartsstabilitet','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#mach','Mach and compressibility','Mach og kompressibilitet','mach and compressibility mach og kompressibilitet','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#coffin','Buffet boundary','Buffetgrense','buffet boundary buffetgrense','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#swept','The swept wing','Pilvingen','the swept wing pilvingen','High-speed flight and drag','Høyfart og motstand'),
 P('highspeed.html#upset','Upset recovery','Upset recovery','upset recovery upset recovery','High-speed flight and drag','Høyfart og motstand'),
 P('airdata.html','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart','static total pressure statisk totaltrykk pitot altimeter høydemåler isa qnh qfe 1013 flight level flygenivå transition overgangshøyde high to low cold temperature kulde density altitude tetthetshøyde ias cas eas tas mach vsi blocked pitot static blokkert alternate static unreliable airspeed upålitelig fart','Virtual Lab · Instruments','Virtual Lab · Instrumenter'),
 P('airdata.html#understand','Key concepts','Nøkkelbegreper','static total pressure isa qnh qfe ias tas mach vsi blockages','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#settings','Altimeter settings','Høydemålerinnstillinger','altimeter settings høydemålerinnstillinger qnh qfe 1013 flight level transition','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#errors','Pressure and temperature errors','Trykk- og temperaturfeil','why the altimeter lies high to low cold temperature kulde','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#speeds','Airspeeds','Farter','ias cas eas tas mach compressibility kompressibilitet','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#blockages','Blockages','Blokkeringer','pitot static blocked blokkert drain alternate static icing ising','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#dd-da','Density altitude','Tetthetshøyde','density altitude tetthetshøyde','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#dd-cold','Cold temperature correction','Kuldekorreksjon','cold temperature correction kuldekorreksjon','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#dd-uas','Unreliable airspeed','Upålitelig fart','unreliable airspeed upålitelig fart adr isis','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('airdata.html#quiz','Test yourself','Test deg selv','quiz','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart'),
 P('clouds.html','Clouds, stability and fog','Skyer, stabilitet og tåke','lift a parcel løft en luftpakke fog overnight tåke gjennom natten in the aircraft i flyet','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('clouds.html#types','Cloud types','Skyslag','cloud types skyslag cirrus cirrocumulus cirrostratus altocumulus altostratus nimbostratus stratocumulus stratus cumulus cumulonimbus ci cc cs ac as ns sc st cu cb tcu','Clouds, stability and fog','Skyer, stabilitet og tåke'),
P('clouds.html#understand','Key concepts','Nøkkelbegreper','lapse rate elr dalr salr stable unstable conditionally unstable dew point cloud base 400 ft advection fog radiation fog visibility br fg hz','Clouds, stability and fog','Skyer, stabilitet og tåke'),
P('clouds.html#lift','Clouds and stability lab','Sky- og stabilitetslabben','lift a parcel løft en luftpakke','Clouds, stability and fog','Skyer, stabilitet og tåke'),
 P('clouds.html#fog','Fog overnight','Tåke gjennom natten','fog overnight tåke gjennom natten','Clouds, stability and fog','Skyer, stabilitet og tåke'),
 P('pressure.html','Pressure and wind','Trykk og vind','pressure highs and lows trykk høytrykk lavtrykk hpa qnh qfe qff isobars isobarer pressure gradient trykkgradient coriolis geostrophic wind geostrofisk vind friction friksjon buys ballot veer back dreier surface wind bakkevind high to low look out below local winds lokale vinder sea breeze sjøbris katabatic katabatisk','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('pressure.html#understand','Pressure, highs and lows','Trykk, høytrykk og lavtrykk','hpa qnh qfe qff station pressure stasjonstrykk 1013.25 isobars isobarer highs lows ridge trough col rygg tråg','Pressure and wind','Trykk og vind'),
 P('pressure.html#explore','Build the wind','Bygg vinden','pressure gradient force trykkgradientkraft coriolis geostrophic wind geostrofisk vind friction friksjon why the wind blows hvorfor vinden blåser highs and lows høytrykk og lavtrykk','Pressure and wind','Trykk og vind'),
 P('pressure.html#try','Try it','Prøv selv','buys ballot back to the wind ryggen mot vinden surface wind estimate bakkevind','Pressure and wind','Trykk og vind'),
 P('pressure.html#debrief','Key points','Det viktigste','buys ballot veer back veerer backer wind with height vind med høyden gradient wind gradientvind diurnal variation døgnvariasjon','Pressure and wind','Trykk og vind'),
 P('pressure.html#altimeter','High to low, look out below','Fra høyt til lavt trykk','high to low look out below qnh altimeter error høydemålerfeil','Pressure and wind','Trykk og vind'),
 P('pressure.html#local','Local winds','Lokale vinder','local winds lokale vinder sea breeze sjøbris land breeze landbris katabatic katabatisk anabatic anabatisk valley wind dalvind','Pressure and wind','Trykk og vind'),
 P('fronts.html','Fronts and air masses','Fronter og luftmasser','air mass source region luftmasse kildeområde warm front varmfront cold front kaldfront occlusion okklusjon frontal slope fronthelning polar front polarfront warm sector varm sektor jet stream jetstrøm frontal passage frontpassering freezing rain underkjølt regn','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('fronts.html#understand','Key concepts: air masses and fronts','Nøkkelbegreper: luftmasser og fronter','air masses mp mt cp ct ma maritime continental polar tropical maritim kontinental the fronts side by side frontene side om side jet streams tropopause sigwx global circulation global sirkulasjon','Fronts and air masses','Fronter og luftmasser'),
 P('fronts.html#explore','Fly through a front','Fly gjennom en front','cross-section vertikalsnitt cloud sequence ci cs as ns skyrekkefølge freezing level frysenivå icing ising qnh wind veers vinden dreier plan view life cycle livssyklus frontal depression frontlavtrykk isobars isobarer','Fronts and air masses','Fronter og luftmasser'),
 P('fronts.html#debrief','Key points: fronts','Det viktigste: fronter','key points det viktigste memory aid huskeregel the sky lowers and thickens himmelen senkes og tykner','Fronts and air masses','Fronter og luftmasser'),
 P('storms.html','Thunderstorms and wind shear','Tordenvær og vindskjær','cu tcu towering cumulus congestus calvus incus anvil ambolt mammatus shelf cloud hyllesky supercell superscelle 3d fly aircraft avoidance night natt cumulonimbus cb thunderstorm tordenvær life cycle livssyklus microburst mikroburst wind shear vindskjær weather radar værradar hail hagl lightning lyn gust front vindkastfront squall line bygelinje embedded cb innleiret','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('storms.html#understand','Key concepts: thunderstorms','Nøkkelbegreper: tordenvær','conditions for a cb vilkår moisture instability lift fuktighet ustabilitet løft updraft downdraft oppvind nedvind storm types stormtyper sigmet embd ts avoidance distances avstand','Thunderstorms and wind shear','Tordenvær og vindskjær'),
 P('storms.html#explore','The storm lab','Stormlabben','life of a cb livet til en cb microburst on final mikroburst på finalen weather radar værradar tilt gain attenuation demping overscan','Thunderstorms and wind shear','Tordenvær og vindskjær'),
 P('storms.html#debrief','Key points: thunderstorms','Det viktigste: tordenvær','key points det viktigste memory aid huskeregel a gain on final is a warning fartsøkning på finalen','Thunderstorms and wind shear','Tordenvær og vindskjær'),
 P('hazards.html','Icing and turbulence','Ising og turbulens','icing ising rime rimis clear ice klaris freezing rain underkjølt regn sld supercooled de-icing avising anti-icing holdover turbulence turbulens mountain wave fjellbølge rotor lenticular cat clear air turbulence jet stream jetstrøm carburettor icing forgasserising','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('hazards.html#concepts','Icing and turbulence: key concepts','Ising og turbulens: nøkkelbegreper','ice types istyper intensity intensitet holdover time','Icing and turbulence','Ising og turbulens'),
 P('hazards.html#explore','Hazards lab: icing, mountain waves, CAT','Farelab: ising, fjellbølger, CAT','cross-section tverrsnitt ice on the wing is på vingen stall steiling','Icing and turbulence','Ising og turbulens'),
 P('hazards.html#quiz','Icing and turbulence test','Test: ising og turbulens','quiz test','Icing and turbulence','Ising og turbulens'),
 P('wxreports.html','Reading the weather','Les værmeldingen','metar speci taf decode avkode becmg tempo prob30 prob40 fm cavok ceiling skydekke rvr nosig trend sigmet airmet sig wx significant weather chart wind temperature chart vfr svfr ifr','Virtual Lab · Meteorology','Virtual Lab · Meteorologi'),
 P('wxreports.html#explore','METAR/TAF decoder and TAF timeline','METAR/TAF-dekoder og TAF-tidslinje','decoder timeline tidslinje sig wx symbols symboler','Reading the weather','Les værmeldingen'),
 P('wxreports.html#quiz','Reading the weather test','Test: les værmeldingen','quiz test','Reading the weather','Les værmeldingen'),
 P('engines.html','Powerplant: piston, turboprop and jet','Motorer: stempel, turboprop og jet','piston stempel four-stroke firetakt mixture blanding carburettor icing forgasserising magneto turboprop free turbine fri turbin torque moment itt ng np beta feather fjæring turbojet turbofan bypass omløp n1 n2 egt thrust lapse flat rating flex hot start varm start hung start hengende start wet start våt start','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('engines.html#understand','Key concepts','Nøkkelbegreper','suck squeeze bang blow sug klem smell blås brayton otto','Powerplant','Motorer'),
 P('engines.html#explore','The engine lab','Motorlabben','compare sammenlign start the engine start motoren ratings and limits rating og grenser','Powerplant','Motorer'),
 P('engines.html#try','Try it','Prøv selv','lean to peak egt len til topp-egt torque limit momentgrense','Powerplant','Motorer'),
 P('engines.html#quiz','Test yourself','Test deg selv','engine quiz motorquiz','Powerplant','Motorer'),
 P('jetsystems.html','Aircraft systems: hydraulics, electrics, fuel, flight controls and landing gear','Flysystemer: hydraulikk, elektrisk, drivstoff, flykontroller og understell','electrics elektrisk alternator generator IDG TR inverter APU RAT bus tie hydraulics hydraulikk PTU accumulator fuel drivstoff crossfeed kryssmating boost pump jettison flight controls flykontroller fly-by-wire trim tab servo tab normal alternate direct law landing gear understell emergency extension brakes anti-skid autobrake piston turboprop jet','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('jetsystems.html#understand','Key concepts','Nøkkelbegreper','key concepts three classes at a glance nøkkelbegreper','Aircraft systems','Flysystemer'),
 P('jetsystems.html#explore','The systems lab','Systemlabben','systems lab failures generator pump leak bus fault imbalance crossfeed gear extension systemlabben feil','Aircraft systems','Flysystemer'),
 P('jetsystems.html#try','Try it','Prøv selv','try it prøv selv','Aircraft systems','Flysystemer'),
 P('jetsystems.html#debrief','Key points','Det viktigste','key points det viktigste','Aircraft systems','Flysystemer'),
 P('jetsystems.html#quiz','Test yourself','Test deg selv','quiz test yourself test deg selv','Aircraft systems','Flysystemer'),
 P('pressurisation.html','Pressurisation and oxygen','Trykkabin og oksygen','cabin altitude kabinhøyde differential pressure differansetrykk outflow valve utløpsventil safety valve sikkerhetsventil negative relief cabin controller landing elevation decompression dekompresjon rapid slow leak fog tåke emergency descent nødnedstigning hypoxia hypoksi time of useful consciousness tuc oxygen oksygen mask maske chemical generator diluter easa 10000 13000','Virtual Lab · Aircraft and engines','Virtual Lab · Fly og motorer'),
 P('pressurisation.html#understand','Key concepts','Nøkkelbegreper','cabin altitude differential pressure outflow valve decompression hypoxia oxygen','Pressurisation and oxygen','Trykkabin og oksygen'),
 P('pressurisation.html#explore','The pressurisation lab','Trykkabinlabben','normal climb descent rapid decompression slow leak oxygen piston turboprop jet','Pressurisation and oxygen','Trykkabin og oksygen'),
 P('pressurisation.html#dd-hyp','Hypoxia and TUC','Hypoksi og TUC','hypoxia hypoksi tuc trapped gas decompression sickness trykkfallssyke','Pressurisation and oxygen','Trykkabin og oksygen'),
 P('pressurisation.html#dd-easa','EASA oxygen requirements','EASAs oksygenkrav','cat.ide.a.235 cat.ide.a.240 nco.op.190 supplemental oxygen','Pressurisation and oxygen','Trykkabin og oksygen'),
 P('pressurisation.html#quiz','Test yourself','Test deg selv','quiz','Pressurisation and oxygen','Trykkabin og oksygen'),
 P('gyros.html','Attitude and heading: compass, gyros and inertial systems','Holdning og kurs: kompass, gyroer og treghetssystemer','magnetic compass magnetkompass variation deviation dip ands unos turning acceleration errors gyroscope rigidity precession heading indicator attitude indicator turn coordinator vacuum ahrs irs adirs ring laser alignment','Virtual Lab · Instruments','Virtual Lab · Instrumenter'),
 P('gyros.html#compass','Magnetic compass: dip, turning and acceleration errors','Magnetkompass: inklinasjon, sving- og akselerasjonsfeil','magnetic compass magnetkompass ands unos dip inklinasjon variation deviation','Attitude and heading','Holdning og kurs'),
 P('gyros.html#gyro','Gyroscopes: rigidity, precession and drift','Gyroskoper: stivhet, presesjon og drift','gyroscopes gyroskoper rigidity precession earth rate transport wander latitude nut','Attitude and heading','Holdning og kurs'),
 P('gyros.html#ops','Attitude, heading and turn instruments','Holdnings-, kurs- og svinginstrumenter','attitude indicator heading indicator turn coordinator vacuum failure glass ahrs','Attitude and heading','Holdning og kurs'),
 P('gyros.html#irs','Inertial reference and AHRS','Treghetsreferanse og AHRS','irs adirs ahrs ring laser mems alignment schuler gnss','Attitude and heading','Holdning og kurs'),
 P('autoflight.html','Automation and warnings: autopilot, TCAS and EGPWS','Automatikk og varsling: autopilot, TCAS og EGPWS','autopilot flight director fd autothrust autothrottle fma flight mode annunciator armed active alt* capture reversion mode traps modusfeller two-axis tokanals hdg nav apr loc g/s v/s level change thrust levers skyvehendler toga tcas ta ra tau resolution advisory unnvikelsesråd egpws gpws pull up terrain sink rate glideslope bank angle radio altimeter radiohøydemåler','Virtual Lab · Instruments','Virtual Lab · Instrumenter'),
 P('autoflight.html#fma','Autopilot and FMA','Autopilot og FMA','fma armed active capture alt* loc g/s light single jet','Automation and warnings','Automatikk og varsling'),
 P('autoflight.html#traps','Mode traps','Modusfeller','mode traps modusfeller reversion v/s altitude behind','Automation and warnings','Automatikk og varsling'),
 P('autoflight.html#autothrust','Autothrust and thrust levers','Autothrust og skyvehendler','autothrust speed thr clb thr idle levers detent toga','Automation and warnings','Automatikk og varsling'),
 P('autoflight.html#tcas','TCAS','TCAS','tcas ta ra tau climb descend follow the ra','Automation and warnings','Automatikk og varsling'),
 P('autoflight.html#gpws','EGPWS','EGPWS','egpws gpws modes pull up terrain look-ahead','Automation and warnings','Automatikk og varsling'),
 P('autoflight.html#radalt','Radio altimeter','Radiohøydemåler','radio altimeter radiohøydemåler','Automation and warnings','Automatikk og varsling'),
 P('performance.html','Take-off and landing performance','Start- og landingsytelse','tora toda asda clearway klarflate stopway stoppflate v1 vr v2 vmcg vmbe balanced field balansert bane accelerate-stop accelerate-go startdistanse wind factoring 50 % 150 % slope helning wet våt contaminated kontaminert flap klaff net flight path nettobane second segment obstacle hinder assumed temperature flex derate flat rating landing distance landingsdistanse 60 % 70 % vref class a class b klasse','Virtual Lab · Performance','Virtual Lab · Ytelse'),
 P('performance.html#understand','Key concepts','Nøkkelbegreper','tora toda asda v1 stop go wind slope wet net path landing margins class a b','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#takeoff','Take-off and V1','Start og V1','take-off v1 go stop balanced field accelerate-stop vmcg vmbe clearway stopway','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#climbout','Climb-out and obstacles','Utflyging og hindre','second segment 2.4 % gross net 0.8 % obstacle 35 ft segments vx vy','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#landing','Landing distance','Landingsdistanse','landing distance landingsdistanse 60 % 70 % 1.67 wet 15 % contaminated vref go-around 2.1 % 3.2 %','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#dd-limits','Take-off mass limits','Begrensninger for startvekt','field climb obstacle tyre speed brake energy structural wat','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#dd-flex','Flat rating and reduced thrust','Flat rating og redusert skyvekraft','flex assumed temperature antatt temperatur derate 25 % toga','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#dd-classes','Performance classes A, B and C','Ytelsesklasse A, B og C','class a b c grass gress 1.25 1.2 1.3 1.43 part-cat','Take-off and landing performance','Start- og landingsytelse'),
 P('performance.html#quiz','Test yourself','Test deg selv','quiz','Take-off and landing performance','Start- og landingsytelse'),
 P('flightplanning.html','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging','vx vy best angle best rate stigning best range best endurance rekkevidde flytid vmd wind headwind motvind optimum altitude step climb ceiling tak cost index kostindeks fuel drivstoff taxi trip contingency uforutsett alternate alternativ final reserve endelig reserve additional extra discretionary minimum fuel mayday fuel pnr etp tankering atc flight plan','Virtual Lab · Performance','Virtual Lab · Ytelse'),
 P('flightplanning.html#understand','Key concepts','Nøkkelbegreper','vx vy range endurance wind jets fly high fuel stack final reserve','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#climb','Climb: Vx and Vy','Stigning: Vx og Vy','vx vy excess thrust power ceiling','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#cruise','Cruise: range and endurance','Marsj: rekkevidde og flytid','best range 1.32 vmd endurance 0.76 vmd headwind tangent lrc cost index','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#fuel','Fuel planning','Drivstoffplanlegging','fuel scheme taxi trip contingency 5 % alternate final reserve 30 45 min additional extra discretionary','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#dd-alt','Altitude, ceilings and step climbs','Høyde, tak og trinnvis stigning','optimum altitude step climb maximum altitude service ceiling buffet','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#dd-enroute','Engine failure en route','Motorstans underveis','drift-down net path 1.1 % 1000 ft 2000 ft escape route','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#alternates','Alternates and planning minima','Alternativer og planleggingsminima','alternates alternativer planning minima two alternates','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#inflight','In-flight fuel','Drivstoff under flyging','minimum fuel mayday fuel fuel check leak','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#dd-pnr','PNR and critical point','PNR og kritisk punkt','pnr point of no return etp critical point','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#tanker','Tankering','Tankering','tankering','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#atc','ATC flight plan','ATC-flygeplan','atc flight plan fpl item 10 item 15 item 18','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('flightplanning.html#quiz','Test yourself','Test deg selv','quiz','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging'),
 P('gennav.html','General navigation','Generell navigasjon','wind triangle vindtrekanten heading track drift wca groundspeed variation deviation misvisning 1 in 60 great circle storsirkel rhumb line loksodrom convergency konvergens lambert mercator utc pet pnr','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('gennav.html#understand','Key concepts','Nøkkelbegreper','true magnetic compass variation deviation heading track drift 1 in 60 great circle convergency utc pet pnr','General navigation','Generell navigasjon'),
 P('gennav.html#triangle','Wind triangle','Vindtrekanten','wind triangle vindtrekanten heading groundspeed drift crp-5 e6b','General navigation','Generell navigasjon'),
 P('gennav.html#sixty','1 in 60','1 av 60','1 in 60 1 av 60 track error closing angle','General navigation','Generell navigasjon'),
 P('gennav.html#earth','Earth and charts','Jorden og kart','great circle rhumb line convergency mercator lambert polar stereographic','General navigation','Generell navigasjon'),
 P('gennav.html#pet','PET and PNR','PET og PNR','pet pnr point of equal time point of safe return','General navigation','Generell navigasjon'),
 P('gennav.html#quiz','Test yourself','Test deg selv','quiz','General navigation','Generell navigasjon'),
 P('radionav.html','Radio navigation simulator','Radionavigasjonssimulator','vor ndb adf rmi hsi cdi obs to from dme slant range ils localiser glide slope holding entry wind triangle radial qdm relative bearing simulator radar transponder ads-b','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('radionav.html#understand','Key concepts','Nøkkelbegreper','radial qdm qdr bearing peiling to from cdi obs rmi adf hsi dme','Radio navigation simulator','Radionavigasjonssimulator'),
 P('radionav.html#explore','The navigation simulator','Navigasjonssimulatoren','lessons leksjoner practice øving instructor instruktør intercept avskjære tracking holding ils','Radio navigation simulator','Radionavigasjonssimulator'),
 P('radionav.html#try','Try it','Prøv selv','try oppgave','Radio navigation simulator','Radionavigasjonssimulator'),
 P('radionav.html#radar','Radar and ADS-B','Radar og ADS-B','radar transponder ssr mode s ads-b squawk','Radio navigation simulator','Radionavigasjonssimulator'),
 P('radionav.html#debrief','Key points','Det viktigste','key points det viktigste','Radio navigation simulator','Radionavigasjonssimulator'),
 P('gnss.html','GNSS and RNAV','GNSS og RNAV','gnss gps satellites satellitter dop hdop raim fde sbas egnos lpv lnav vnav rnp apch rnav pbn fly-by fly-over cdi scaling containment jamming spoofing','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('gnss.html#understand','Key concepts: GNSS and PBN','Nøkkelbegreper: GNSS og PBN','pseudorange dop raim fde sbas egnos rnav rnp pbn specifications path terminators','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#explore','GNSS and RNP lab','GNSS- og RNP-labben','sky plot dop raim fde egnos lpv lnav vnav fly-by fly-over cdi scaling containment jamming','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#try','Try it','Prøv selv','tasks oppgaver','GNSS and RNAV','GNSS og RNAV'),
 P('gnss.html#quiz','Test yourself','Test deg selv','quiz','GNSS and RNAV','GNSS og RNAV'),
 P('holding.html','Holding and instrument approach','Holding og instrumentinnflyging','holding entry sectors teardrop parallel direct wind correction ils localiser glide slope rate of descent cdfa missed approach da mda type a b innflygingssektorer dråpe parallell direkte vindkorreksjon glidebane sinkrate avbrutt innflyging','Virtual Lab · Navigation','Virtual Lab · Navigasjon'),
 P('holding.html#understand','Key concepts: holds and approaches','Nøkkelbegreper: holding og innflyging','anatomy segments minima cat i ii iii','Holding and instrument approach','Holding og instrumentinnflyging'),
 P('holding.html#explore','Hold and approach lab','Holding- og innflygingslab','entry trainer wind ils cdfa missed approach rate of descent','Holding and instrument approach','Holding og instrumentinnflyging'),
 P('holding.html#try','Try it','Prøv selv','tasks oppgaver','Holding and instrument approach','Holding og instrumentinnflyging'),
 P('holding.html#quiz','Test yourself','Test deg selv','quiz','Holding and instrument approach','Holding og instrumentinnflyging'),
 P('orientation.html','Spatial orientation and illusions','Romlig orientering og illusjoner','spatial disorientation desorientering vestibular inner ear indre øre leans graveyard spiral dødsspiral somatogravic false climb go-around coriolis black hole svart hull runway slope width illusion papi','Virtual Lab · Human factors','Virtual Lab · Menneskelige faktorer'),
 P('orientation.html#understand','Key concepts','Nøkkelbegreper','vision semicircular canals otoliths leans spiral somatogravic coriolis runway illusions','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('orientation.html#ear','The leans','The leans','leans threshold 2 deg/s canal','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('orientation.html#trainer','Graveyard spiral','Dødsspiral','graveyard spiral spin roll-out','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('orientation.html#approach','Approach illusions','Illusjoner på innflyging','runway slope width upslope narrow black hole featureless papi','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('orientation.html#dd-vest','Vestibular illusions','Vestibulære illusjoner','somatogravic inversion elevator coriolis','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('orientation.html#quiz','Test yourself','Test deg selv','quiz','Spatial orientation and illusions','Romlig orientering og illusjoner'),
 P('humanperf.html','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet','attention oppmerksomhet workload arbeidsbelastning startle skvettreaksjon automation mode confusion tem threat error crm assertiveness for-dec dodar fatigue tretthet wocl alcohol alkohol medication hypoxia hypoksi imsafe','Virtual Lab · Human factors','Virtual Lab · Menneskelige faktorer'),
 P('humanperf.html#workload','Workload and attention','Arbeidsbelastning og oppmerksomhet','workload capacity startle underload inverted u','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#fatigue','Fatigue and the body clock','Tretthet og døgnrytme','fatigue sleep debt circadian wocl frm alcohol equivalent','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#tem','Threat and error','Trussel og feil','tem threat error undesired aircraft state crm speak up sop','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#dd-dec','Decision making','Beslutninger','for-dec dodar plan continuation bias hazardous attitudes','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#dd-hyp','Hypoxia','Hypoksi','hypoxia time of useful consciousness tuc hyperventilation','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#vision','Vision and see-and-avoid','Syn og se-og-unngå','vision scanning night vision dark adaptation','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
 P('humanperf.html#quiz','Test yourself','Test deg selv','quiz','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet'),
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
 P('training.html','Training: overview','Trening: oversikt','training trening overview oversikt simulators simulatorer simulator cessna 172 c172 da42 king air b200 ifr trainer ifr-trener briefing radio type rating typerating checkride sim check','Simulators, briefings, radio and check preparation','Simulatorer, briefinger, radio og kontrollforberedelse'),
 P('radio.html','Gate to gate','Gate to gate','gate to gate radio atc phraseology fraseologi checklist sjekkliste flow startup taxi clearance klarering da42','A whole trip in order with an AI controller','En hel tur i rekkefølge med AI-flygeleder'),
 P('briefing.html','Briefings (TSADMM)','Briefinger (TSADMM)','briefing departure brief approach brief tsadmm avgangsbrief innflygingsbrief plate','Brief a departure or approach and get a score','Brief en avgang eller innflyging og få poeng'),
 P('radio-drills.html','Radio drills','Radiodriller','radio drill readback tilbakelesing atc calls','Short radio exercises','Korte radioøvelser'),
 P('ifr.html','IFR trainer','IFR-trener','ifr instrument trainer instrumenttrener radio navigation radionavigasjon vor ndb adf rmi rbi cdi hsi pfd dme radial intercept tracking holding procedure turn base turn approach innflyging','Learn each procedure: understand, think, fly, debrief','Lær hver prosedyre: forstå, tenk, fly, debrief'),
 P('ifr.html#orient','Radial orientation','Radialorientering','which radial am i on hvilken radial obs from to rmi tail hale','IFR trainer','IFR-trener'),
 P('ifr.html#trackIn','Track inbound to a VOR','Følge kurs inn til VOR','tracking inbound wind correction vindkorreksjon cdi needle nål','IFR trainer','IFR-trener'),
 P('ifr.html#intIn','Intercept a course','Fange en kurs','intercept interception 30 45 lead ledning overshoot','IFR trainer','IFR-trener'),
 P('ifr.html#ndb','NDB homing and tracking','NDB homing og tracking','ndb adf rbi homing tracking drift avdrift qdm qdr','IFR trainer','IFR-trener'),
 P('ifr.html#dme','DME arc','DME-bue','dme arc bue lead radial ledende radial wingtip','IFR trainer','IFR-trener'),
 P('ifr.html#holdEntry','Holding entry','Inngang til holding','holding entry inngang direct direkte parallel parallell teardrop offset 70','IFR trainer','IFR-trener'),
 P('ifr.html#hold','Holding pattern','Holdingmønster','holding pattern timing wind correction triple tre ganger outbound','IFR trainer','IFR-trener'),
 P('ifr.html#pt','Procedure turn 45/180','Prosedyresving 45/180','procedure turn prosedyresving 45 180 protected side','IFR trainer','IFR-trener'),
 P('ifr.html#base','Base turn','Base turn','base turn reversal','IFR trainer','IFR-trener'),
 P('ifr.html#vordme','VOR/DME approach','VOR/DME-innflyging','vor dme approach cdfa mda profile profil faf','IFR trainer','IFR-trener'),
 P('ifr.html#ils','ILS approach','ILS-innflyging','ils localiser localizer glide slope glidebane da decision altitude','IFR trainer','IFR-trener'),
 P('fi.html','Flight Intelligence','Flight Intelligence','flight intelligence instructor instruktør afm poh fcom qrh sop aircraft systems systemer limitations begrensninger oral exam muntlig scenario revision repetisjon documents dokumenter','Your own instructor that answers from your documents','Din egen instruktør som svarer fra dokumentene dine'),
 P('checkride.html','Check preparation','Kontrollforberedelse','checkride pc skill test oral muntlig examiner eksaminator easa questions spørsmål','The instructor questions you like an examiner, from your documents','Instruktøren spør deg ut som en eksaminator, fra dokumentene dine'),
 P('cockpit.html','Glass cockpit simulator','Glass cockpit-simulator','glass cockpit simulator pfd mfd autopilot da42 ils vor take-off avgang procedures prosedyrer','Fly the DA42 with a glass-cockpit panel','Fly DA42 med et glass cockpit-panel'),
 P('b200.html','King Air B200 cockpit trainer','King Air B200 cockpittrener','king air b200 turboprop autofeather engine start motorstart emergency descent nøddescent pressurisation trykkabin beta reverse procedures prosedyrer','Classic analog panel, procedures and emergencies','Klassisk analogt panel, prosedyrer og nødprosedyrer'),
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
    return {h:L({en:`Rate of descent on ${ang}°`,no:`Sinkrate på ${ang}°`}),v:`${r0(gs*f/10)*10} ft/min · ${r0(Math.tan(ang*Math.PI/180)*6076)} ft/NM`,u:'holding.html#explore'}; } }
  // gradient: 3.3 % 120 kt
  if((m=t.match(/(\d{1,2}(?:\.\d+)?)\s*%\D{0,10}(\d{2,3})\s*kt/))){ const g=num(m[1]), gs=+m[2]; return {h:L({en:`Climb gradient ${g} %`,no:`Stigegradient ${g} %`}),v:`${r0(g*60.76)} ft/NM · ${r0(g*gs*1.013/10)*10} ft/min ${L({en:'at',no:'ved'})} ${gs} kt`,u:'prep.html#s-grad'}; }
  // trykkhøyde / tetthetshøyde: elev 1500 qnh 1003 (t 25)
  if((m=t.match(/(?:elev|elevation|høyde|pa|alt)\D{0,4}(-?\d{1,5})\D{0,12}qnh\D{0,3}(\d{3,4})(?:\D{1,10}(?:t|temp|oat)\D{0,3}(-?\d{1,2}))?/))||(m=t.match(/qnh\D{0,3}(\d{3,4})\D{0,12}(?:elev|elevation|høyde|alt)\D{0,4}(-?\d{1,5})(?:\D{1,10}(?:t|temp|oat)\D{0,3}(-?\d{1,2}))?/))){ let el=+m[1], q=+m[2]; if(q<900){ [el,q]=[q,el]; } if(q>900&&q<1100){ const pa=el+(1013-q)*30; let v=`${L({en:'Pressure altitude',no:'Trykkhøyde'})} ${r0(pa)} ft`; if(m[3]!=null){ const isa=15-2*pa/1000, da=pa+120*(+m[3]-isa); v+=` · ${L({en:'density altitude',no:'tetthetshøyde'})} ≈ ${r0(da/10)*10} ft (ISA ${r1(isa)} °C)`; } return {h:L({en:'Pressure altitude',no:'Trykkhøyde'}),v,u:'altimetry.html'}; } }
  // skybase: temp 16 dew 11 / 16/11
  if((m=t.match(/(?:cloud base|skybase|spread|spredning)\D{0,6}(-?\d{1,2})\D{1,8}(-?\d{1,2})/))){ const a=+m[1], b=+m[2]; return {h:L({en:'Cumulus cloud base',no:'Cumulus-skybase'}),v:`(${a} − ${b}) × 400 ≈ ${r0(Math.max(0,a-b)*400/100)*100} ft AGL`,u:'clouds.html#lift'}; }
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
