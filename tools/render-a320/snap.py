import sys, json, re, numpy as np; sys.path.insert(0, '/home/claude/rend'); import map as mp
from PIL import Image, ImageDraw
T = json.load(open('/tmp/a320_t.json')); K = 1.426; byn = {t[0]: t for t in T}
def ref(n): t = byn[n]; return np.array([(t[1] + t[3] / 2) * K, (t[2] + t[4] / 2) * K])
A = {'ovh': ('ovh', [('ADR 1', 'ADR1Btn.*'), ('ADR 2', 'ADR2Btn.*'), ('ELAC 2', 'ELAC2Btn.*'), ('BAT 1', 'BatteryBtn1.*'), ('L TK PUMP 1', 'LFuelTank1Btn.*'), ('R TK PUMP 2', 'RFuelTank2Btn.*'), ('ENG 1 BLEED', 'Eng1BleedBtn.*'), ('ENG 2 BLEED', 'Eng2BleedBtn.*'),
      ('WING A-ICE', 'WingAntiIceBtn.*'), ('APU START', 'APUStartBtn.*'), ('EXTRACT', 'VentExtractBtn.*'), ('TERR', 'GPWSTerrBtn.*'), ('ENG 2 AGENT 2', 'Eng2FireAgt2Btn.*'), ('ENG 1 AGENT 1', 'Eng1FireAgt1Btn.*'), ('IR 1', 'IR1Btn.*'), ('FAC 2', 'FAC2Btn.*'), ('DITCHING', 'DitchBtn.*'), ('WIPER CPT', 'LeftWiperKnb'), ('WIPER F/O', 'RightWiperKnb'), ('STROBE', 'StrobeLtSwtch'), ('EMER EXIT LT', 'EmerExtLtSwtch'), ('MECH', 'GroundCall'), ('CAB FANS', 'CabinFansBtn.*'), ('LDG ELEV', 'LdgElevKnb'), ('NOSE LT', 'NoseLtSwtch'), ('RWY TURN OFF', 'TurnoffLtSwtch'), ('SEAT BELTS', 'SeatBeltSwtch'), ('ANN LT', 'AnnunciatorLtSwtch'), ('X BLEED', 'XbleedKnb')]),
     'aft': ('ovh', [('DATA LOADER NEXT', 'DLSSysNextBtn'), ('DATA LOADER SEL', 'DLSSysSelCtlBtn'), ('TOILET', 'ToiletBtn'), ('ELT TEST/RESET', 'EltTestRst'), ('READING LT L', 'LReadingLtKnb'), ('READING LT R', 'RReadingLtKnb'), ('AUDIO SWITCHING', 'audio_swtg'), ('OXY TMR RESET', r'OVH_button\.047'), ('AVNCS COMPT LT', r'OVH_button\.027'), ('APU AUTO EXTING TEST', r'OVH_button\.028'), ('FADEC GND PWR 2', r'OVH_button\.032'), ('BLUE PUMP OVRD', r'OVH_button\.033'), ('APU AUTO EXTING RESET', 'APUExtReset')]),
     'glare': ('front', [('AP 1', 'ap1'), ('AP 2', 'ap2'), ('LOC', 'loc'), ('APPR', 'appr'), ('EXPED', 'exped'), ('A/THR', 'a-thr'), ('FD CPT', 'fd1'), ('FD F/O', 'fd2'), ('LS CPT', 'ils'), ('LS F/O', 'ils2'), ('CHRONO CPT', 'chrono_cpt'), ('CHRONO F/O', 'chrono_fo'), ('CSTR', 'cstr'), ('CSTR F/O', r'cstr\.001'), ('ND MODE CPT', 'nd_mode'), ('ND MODE F/O', 'nd_mode_fo'), ('TABLE LT CPT', 'lt_knb_1'), ('TABLE LT F/O', 'lt_knb_2'), ('GLARESHIELD INTEG LT', 'fcu_integ_knb1'), ('FCU DISPLAY BRT', 'fcu_integ_knb2'), ('SIDE STICK PRIORITY CPT', 'prio_capt'), ('SIDE STICK PRIORITY F/O', 'prio_fo')]),
     'main': ('front', [('AUTO BRK LO', 'abs_low'), ('AUTO BRK MAX', 'abs_max'), ('BRK FAN', 'brk_fan'), ('TERR ON ND CPT', 'terr_on_nd_l'), ('TERR ON ND F/O', 'terr_on_nd_r'), ('GPWS G/S CPT', r'gpws_gs_sw\.cpt'), ('GPWS G/S F/O', r'gpws_gs_sw\.fo')]),
     'ped': ('ped', [('ENG', 'ecam_eng'), ('FUEL', 'ecam_fuel'), ('CLR L', 'ecam_clr_l'), ('CLR', 'ecam_clr_r'), ('VHF 1', r'radio_vhf1\.cpt'), ('VHF 1 F/O', r'radio_vhf1\.fo'), ('BFO', r'radio_bfo\.cpt'), ('BFO F/O', r'radio_bfo\.fo'),
          ('VOICE', r'audio_voice\.cpt'), ('RESET F/O', r'audio_reset\.fo'), ('PWS', 'radar_pws'), ('RUD TRIM RESET', 'RudderTrimReset'), ('DOOR VIDEO', 'CockpitDoorVideoButton'), ('DOOR OPEN/FAULT', 'CockpitDoor'), ('GRAVITY GEAR EXTN', 'gravity_gear'), ('RUD TRIM', 'RudderTrim')])}
def homog(X, Y):
    if len(X) < 8: G = np.c_[X, np.ones(len(X))]; M, *_ = np.linalg.lstsq(G, Y, rcond=None); return lambda p: np.c_[np.atleast_2d(p), np.ones(len(np.atleast_2d(p)))] @ M
    mx, sx = X.mean(0), X.std(0).mean(); my, sy = Y.mean(0), Y.std(0).mean(); Xn = (X - mx) / sx; Yn = (Y - my) / sy; R = []
    for (x, y), (u, v) in zip(Xn, Yn): R += [[x, y, 1, 0, 0, 0, -u * x, -u * y, -u], [0, 0, 0, x, y, 1, -v * x, -v * y, -v]]
    h = np.linalg.svd(np.array(R))[2][-1].reshape(3, 3)
    def f(p): q = np.c_[(np.atleast_2d(p) - mx) / sx, np.ones(len(np.atleast_2d(p)))] @ h.T; return q[:, :2] / q[:, 2:] * sy + my
    return f
F = {}
for s, (v, L) in A.items():
    X = np.array([ref(n) for n, _ in L]); Y = np.array([mp.centre(v, p) for _, p in L]); F[s] = homog(X, Y); print(s, 'max residual px', np.abs(F[s](X) - Y).max(0).round(1))
VIEW = {'ovh': 'ovh', 'aft': 'ovh', 'glare': 'front', 'main': 'front', 'ped': 'ped'}
def sect(t):
    cy = (t[2] + t[4] / 2) * K; cx = (t[1] + t[3] / 2) * K
    if cy > 1870 and (cx < 400 or cx > 1026): return 'side'
    return 'aft' if cy < 635 else 'ovh' if cy < 1250 else 'glare' if cy < 1414 else 'main' if cy < 1712 else 'ped'
# candidate control objects per view: small things only
C = {}
for v in ('ovh', 'front', 'ped'):
    L = []
    c0, x0, up0, W0, H0 = mp.V[v]; n0 = np.cross(x0, up0)
    for o in mp.O:
        if abs((o['v'].mean(0) - c0) @ n0) > (0.3 if v == 'ped' else 0.22): continue
        q = mp.proj(v, o['v']); mn, mx = q.min(0), q.max(0); d = mx - mn
        if 8 < d[0] < 300 and 8 < d[1] < 300 and POS_OK(v, mn, mx) if False else (8 < d[0] < 300 and 8 < d[1] < 300): L.append((o['name'], mn, mx))
    C[v] = L
def side(pat, sg):
    P = np.concatenate([o['v'] for o in mp.O if re.fullmatch(pat, o['name'])]); return P[P[:, 2] * sg > 0]
EX = {}
def ex(n, v, pat, sg=0): EX[n] = (v, pat, sg)
for n, p in {'STROBE': 'StrobeLtSwtch', 'BEACON': 'BeaconLtSwtch', 'WING LT': 'WingLtSwtch', 'NAV & LOGO': 'NavLogoLtSwtch', 'RWY TURN OFF': 'TurnoffLtSwtch', 'LAND L': 'LandingLtSwtch', 'LAND R': 'LandingLtRSwtch', 'NOSE LT': 'NoseLtSwtch', 'DOME': 'DomeLtSwtch',
             'ICE IND & STBY COMPASS': 'StbyCompassLtSwtch', 'ANN LT': 'AnnunciatorLtSwtch', 'OVHD INTEG LT': 'OHPMarkLtKnb', 'SEAT BELTS': 'SeatBeltSwtch', 'NO SMOKING': 'NoSmokingSwtch', 'EMER EXIT LT': 'EmerExtLtSwtch', 'EXIT LT OFF': 'EmerExtLtBtn.*',
             'MECH': 'GroundCall', 'ALL': 'AllCabinCall', 'FWD': 'FwdCabinCall', 'AFT': 'AftCabinCall', 'EMER': 'EmerCall(Btn.*|Prot)', 'RAIN RPLNT CPT': 'LeftRainTest', 'RAIN RPLNT F/O': 'RightRainTest', 'WIPER CPT': 'LeftWiperKnb', 'WIPER F/O': 'RightWiperKnb', 'MAN V/S CTL': 'ManVSCTLSwitch',
             'LDG ELEV': 'LdgElevKnb', 'X BLEED': 'XbleedKnb', 'ELT TEST/RESET': 'EltTestRst', 'ELT': 'ELTSw.*', 'READING LT L': 'LReadingLtKnb', 'READING LT R': 'RReadingLtKnb', 'AUDIO SWITCHING': 'audio_swtg', 'TOILET': 'ToiletBtn.*', 'DATA LOADER ON/OFF': 'DLSSysSwtch',
             'DATA LOADER NEXT': 'DLSSysNextBtn', 'DATA LOADER PREV': 'DLSSysPrevBtn', 'DATA LOADER SEL': 'DLSSysSelCtlBtn', 'APU AUTO EXTING RESET': 'APUExtReset', 'OXY TMR RESET': r'OVH_button\.047', 'SVCE INT OVRD': r'OVH_button\.026', 'AVNCS COMPT LT': r'OVH_button\.027',
             'BLUE PUMP OVRD': r'(OVH_button\.033|Plane\.018)', 'LEAK MEAS G': r'(OVH_button\.030|Plane\.017)', 'LEAK MEAS B': r'(OVH_button\.031|Plane\.014)', 'LEAK MEAS Y': r'(OVH_button\.032|Plane\.016)', 'APU AUTO EXTING TEST': r'OVH_button\.028',
             'FADEC GND PWR 1': r'(OVH_button\.029|Plane\.020)', 'FADEC GND PWR 2': r'(OVH_button\.046|Plane\.019)'}.items(): ex(n, 'ovh', p)
for sfx, m1, sg in ((' CPT', '', 1), (' F/O', '.001', -1)):
    c = sfx == ' CPT'; k = '' if c else ' F/O'
    for n, p in {'CSTR': 'cstr', 'WPT': 'wpt', 'VOR.D': 'vord', 'NDB': 'ndb', 'ARPT': 'arpt'}.items(): ex(n + k, 'front', re.escape(p + m1))
    ex('FD' + sfx, 'front', 'fd1' if c else 'fd2'); ex('LS' + sfx, 'front', 'ils' if c else 'ils2'); ex('QNH' + sfx, 'front', 'qnh_cpt_sw' if c else 'qnh_fo_sw'); ex('ND MODE' + sfx, 'front', 'nd_mode' if c else 'nd_mode_fo'); ex('ND RANGE' + sfx, 'front', 'nd_range' if c else 'nd_range_fo')
    ex('ADF/VOR 1' + sfx, 'front', 'vor-adf1' if c else 'vor-adf-1-right'); ex('ADF/VOR 2' + sfx, 'front', 'vor-adf2' if c else 'vor-adf-2-right'); ex('CHRONO' + sfx, 'front', 'chrono_cpt' if c else 'chrono_fo'); ex('SIDE STICK PRIORITY' + sfx, 'front', 'prio_capt.*' if c else 'prio_fo.*')
    ex('MASTER WARN' + sfx, 'front', 'master_warning', sg); ex('MASTER CAUT' + sfx, 'front', 'master_caution', sg); ex('AUTO LAND' + sfx, 'front', 'autoland_light', sg); ex('ATC MSG' + sfx, 'front', 'atc_msg', sg); ex('TABLE LT' + sfx, 'front', 'lt_knb_1' if c else 'lt_knb_2')
    ex('PFD BRT' + sfx, 'front', 'pfd_brt_cpt' if c else 'pfd_brt_fo'); ex('LOUDSPEAKER' + sfx, 'front', 'speaker_volume_cpt' if c else 'speaker_volume_fo'); ex('CONSOLE/FLOOR LT' + sfx, 'front', 'light_console_cpt_sw' if c else 'light_console_fo_sw'); ex('PFD/ND XFR' + sfx, 'front', 'pfd_nd_xfr_sw' if c else 'pfd_nd_xfr_sw2')
    ex('GPWS G/S' + sfx, 'front', r'gpws_gs_sw\.' + ('cpt' if c else 'fo')); ex('TERR ON ND' + sfx, 'front', 'terr_on_nd_l' if c else 'terr_on_nd_r')
for n, p in {'SPD/MACH': 'spd-mach', 'SPD': 'spd-sel', 'HDG': 'hdg_sel', 'LOC': 'loc', 'HDG V/S - TRK FPA': 'hdg-vs', 'AP 1': 'ap1', 'AP 2': 'ap2', 'A/THR': 'a-thr', 'METRIC ALT': 'metric_alt', 'V/S': 'vs-sel', 'EXPED': 'exped', 'APPR': 'appr', 'ALT': 'alt-sel.*',
             'GLARESHIELD INTEG LT': 'fcu_integ_knb1', 'FCU DISPLAY BRT': 'fcu_integ_knb2', 'AUTO BRK LO': 'abs_low', 'AUTO BRK MED': 'abs_med', 'AUTO BRK MAX': 'abs_max', 'BRK FAN': 'brk_fan', 'LDG GEAR IND': '[lnr]gear', 'GEAR LEVER': 'gear_lever'}.items(): ex(n, 'front', p)
for n, p in {'ATT HDG': 'ecam_att_hdg', 'AIR DATA': 'ecam_air_data', 'EIS DMC': 'ecam_eis_dmc', 'ECAM/ND XFR': 'ecam_nd_xfr', 'UPPER DISPLAY': 'ecam_brt_upper', 'LOWER DISPLAY': 'ecam_brt_lower', 'T.O CONFIG': 'ecam_to_config', 'EMER CANC': 'ecam_emer_canc', 'ENG': 'ecam_eng', 'BLEED': 'ecam_bleed',
             'PRESS': 'ecam_press', 'ELEC': 'ecam_elec', 'HYD': 'ecam_hyd', 'FUEL': 'ecam_fuel', 'APU': 'ecam_apu', 'COND': 'ecam_cond', 'DOOR': 'ecam_door', 'WHEEL': 'ecam_wheel', 'F/CTL': 'ecam_fctl', 'ALL': None, 'CLR L': 'ecam_clr_l', 'STS': 'ecam_sts', 'RCL': 'ecam_rcl', 'CLR': 'ecam_clr_r',
             'FLOOD LT MAIN PNL': 'flood_lt_main', 'INTEG LT MAIN PNL & PED': 'integ_lt', 'FLOOD LT PED': 'flood_lt_ped', 'AIDS PRINT': 'vu112_aids', 'DFDR EVENT': 'vu112_dfdr', 'GAIN': 'radar_gain', 'MULTISCAN': 'radar_multiscan', 'GCS': 'radar_gcs', 'TILT': 'radar_tilt', 'WX MODE': 'radar_mode',
             'WX SYS': 'radar_sys', 'PWS': 'radar_pws', 'XPDR MODE': 'atc_thrt', 'ATC 1/2': 'atc_sys', 'ALT RPTG': 'atc_abv', 'XPDR KEYPAD': r'atc_(\d|clr)', 'XPDR CODE': 'atc_screen', 'IDENT': 'atc_ident', 'TCAS TRAFFIC': 'atc_fail', 'TCAS MODE': 'atc_stby',
             'ENG MASTER 1': 'Lcutoff', 'ENG MASTER 2': 'Rcutoff', 'ENG MODE SEL': 'eng_mode', 'ENG 1 FIRE/FAULT': 'engine_(fire|fault)_1', 'ENG 2 FIRE/FAULT': 'engine_(fire|fault)_2', 'THR LVR 1': 'thr_l_body', 'THR LVR 2': 'thr_r_body', 'A/THR DISC 1': 'thr_l_button', 'A/THR DISC 2': 'thr_r_button',
             'SPEED BRAKE LEVER': 'SpdBrk', 'FLAPS LEVER': 'FlapsLever.*', 'RUD TRIM': 'RudderTrim', 'RUD TRIM RESET': 'RudderTrimReset', 'PARKING BRAKE': 'ParkBrk', 'GRAVITY GEAR EXTN': 'gravity_gear', 'DOOR OPEN/FAULT': 'CockpitDoor(Fault|Open)?', 'DOOR LOCK': 'CockpitDoorSwitch', 'DOOR VIDEO': 'CockpitDoorVideoButton'}.items():
    if p and n != 'ALL': ex(n, 'ped', p)
ex('PITCH TRIM WHEEL L', 'ped', 'trim_1', 1); ex('PITCH TRIM WHEEL R', 'ped', 'trim_1', -1)
EX_ALL_ECAM = ('ped', 'ecam_all')
for sfx, tag, v in (('', 'cpt', 'ped'), (' F/O', 'fo', 'ped'), (' OVHD', 'ovh', 'ovh')):
    for n, p in {'VHF 1 TX': 'audio_call_vhf1', 'VHF 2 TX': 'audio_call_vhf2', 'VHF 3 TX': 'audio_call_vhf3', 'HF 1 TX': 'audio_call_hf1', 'HF 2 TX': 'audio_call_hf2', 'INT TX': 'audio_mech', 'CAB TX': 'audio_att', 'VHF 1 VOL': 'audio_vhf1', 'VHF 2 VOL': 'audio_vhf2', 'VHF 3 VOL': 'audio_vhf3',
                 'HF 1 VOL': 'audio_hf1', 'HF 2 VOL': 'audio_hf2', 'INT VOL': 'audio_int', 'CAB VOL': 'audio_cab', 'INT/RAD': 'audio_int_rad', 'VOICE': 'audio_voice', 'RESET': 'audio_reset', 'PA VOL': 'audio_pa_rot', 'PA TX': 'audio_pa', 'VOR 1 VOL': 'audio_vor1', 'VOR 2 VOL': 'audio_vor2',
                 'MKR VOL': 'audio_mkr', 'ILS VOL': 'audio_ils', 'MLS VOL': 'audio_mls', 'ADF 1 VOL': 'audio_adf1', 'ADF 2 VOL': 'audio_adf2'}.items(): ex(n + sfx, v, re.escape(p) + r'(_glare)?\.' + tag)
    if tag != 'ovh':
        for n, p in {'XFER': 'radio_exchange', 'VHF 1': 'radio_vhf1', 'VHF 2': 'radio_vhf2', 'VHF 3': 'radio_vhf3', 'HF 1': 'radio_hf1', 'HF 2': 'radio_hf2', 'AM': 'radio_am', 'NAV': 'radio_nav', 'VOR': 'radio_vor', 'ILS': 'radio_ls', 'MLS': 'radio_opt', 'ADF': 'radio_adf', 'BFO': 'radio_bfo'}.items(): ex(n + sfx, v, re.escape(p) + r'\.' + tag)
        i = '1' if tag == 'cpt' else '2'; ex(f'RMP {i} FREQ', v, r'radio_rot\d\.' + tag); ex(f'RMP {i} ON/OFF', v, r'radio_on\.' + tag)
ex('ALL|ecam', 'ped', 'ecam_all')
DROP = {'ENG 1 N1 MODE', 'ENG 2 N1 MODE'}
NOSNAP = {'thr', 'trimw', 'spd', 'flaps', 'gear', 'park', 'crank', 'stick', 'tiller', 'box', 'keys', 's', 'disc'}
out = {}; snapped = 0; SN = {}; named = 0
for t in T:
    n, x, y, w, h, kd, tid = t; s = sect(t)
    if s == 'side' or n in DROP: continue
    key = 'ALL|ecam' if (n == 'ALL' and s == 'ped') else n
    if key in EX and not (n == 'ALL' and s == 'ovh' and False):
        v, pat, sg = EX[key]
        if VIEW[s] == v:
            try:
                P = side(pat, sg) if sg else mp.obj(pat); q = mp.proj(v, P); mn, mx = q.min(0), q.max(0); e = F[s](np.array([[x * K, y * K], [(x + w) * K, (y + h) * K]])); bw, bh = abs(e[1] - e[0]); cc = (mn + mx) / 2
                sw, sh = max(mx[0] - mn[0], min(bw, 70) * 0.8), max(mx[1] - mn[1], min(bh, 70) * 0.8); out[tid] = [round(float(z), 1) for z in (cc[0] - sw / 2, cc[1] - sh / 2, sw, sh)] + [s]; SN[tid] = None; named += 1; continue
            except (KeyError, ValueError) as err: print('  no model object for', n, pat)
    f = F[s]; c = f(np.array([[(x + w / 2) * K, (y + h / 2) * K]]))[0]; e = f(np.array([[(x) * K, (y) * K], [(x + w) * K, (y + h) * K]])); bw, bh = abs(e[1] - e[0])
    b = [c[0] - bw / 2, c[1] - bh / 2, bw, bh]
    if kd not in NOSNAP:
        best = None
        for name, mn, mx in C[VIEW[s]]:
            cc = (mn + mx) / 2; d = np.hypot(*(cc - c)); size = (mx - mn)
            if d < 48 and size.max() < max(bw, bh) * 2.2 + 30 and (best is None or d < best[0]): best = (d, cc, name)
        if best:
            mn = np.array([1e9, 1e9]); mx = -mn
            for name, a, bb in C[VIEW[s]]:
                if np.hypot(*((a + bb) / 2 - best[1])) < 14 and (bb - a).max() < max(bw, bh) * 2.2 + 30: mn = np.minimum(mn, a); mx = np.maximum(mx, bb)
            cc = (mn + mx) / 2; sw, sh = max(mx[0] - mn[0], bw * 0.8), max(mx[1] - mn[1], bh * 0.8); b = [cc[0] - sw / 2, cc[1] - sh / 2, sw, sh]; snapped += 1
    if kd not in NOSNAP and not best:
        nb = sorted(((np.hypot(*(((mn + mx) / 2) - c)), nm) for nm, mn, mx in C[VIEW[s]]))[:2]; print('  unsnapped', s, n, kd, [(round(float(d)), nm) for d, nm in nb])
    SN[tid] = best[2] if (kd not in NOSNAP and best) else None
    REL = {'RMP 1 ACTIVE': (r'radio_exchange\.cpt', -172, -25, 140, 50), 'RMP 1 STBY/CRS': (r'radio_exchange\.cpt', 33, -25, 135, 50), 'RMP 2 ACTIVE': (r'radio_exchange\.fo', -172, -25, 140, 50), 'RMP 2 STBY/CRS': (r'radio_exchange\.fo', 33, -25, 135, 50), 'RUD TRIM IND': ('RudderTrimReset', -55, -103, 110, 46)}
    if n in REL: pat, dx, dy, ww, hh = REL[n]; cc = mp.centre('ped', pat); b = [cc[0] + dx, cc[1] + dy, ww, hh]
    if n == 'CVR HEADSET': b = [3004, 148, 56, 56]
    out[tid] = [round(float(q), 1) for q in b] + [s]
for side, v, sfx in (('L', 'sideL', 'CPT'), ('R', 'sideR', 'F/O')):
    out[('CPT' if side == 'L' else 'F/O') + ' SIDE CONSOLE|SIDESTICK ' + sfx] = [round(float(q), 1) for q in mp.box(v, 'sidestick_1' if side == 'L' else 'sidestick_2')] + ['side']
    out[('CPT' if side == 'L' else 'F/O') + ' SIDE CONSOLE|TILLER ' + sfx] = [round(float(q), 1) for q in mp.box(v, 'tiller' if side == 'L' else 'tillerFo')] + ['side']
for k, b in {'PFD CPT': (530, 4435, 545, 524), 'ND CPT': (1129, 4436, 545, 524), 'E/WD (upper ECAM)': (2219, 4407, 558, 526), 'SD (lower ECAM)': (2219, 4975, 558, 526), 'ND F/O': (3238, 4434, 558, 524), 'PFD F/O': (3839, 4435, 558, 524), 'STANDBY (ISIS)': (1956, 4677, 188, 176),
           'DCDU 1': (1796, 5272, 284, 190), 'DCDU 2': (2875, 5272, 284, 190), 'MCDU 1': (1695, 5604, 430, 656), 'MCDU 2': (2790, 5604, 430, 656), 'CIRCUIT BREAKERS': (1971, 70, 955, 1293), 'CKPT DOOR CONT': (1586, 396, 361, 116)}.items(): out[k] = list(b) + ['whole']
import collections
print('dups', [(k, [n for n in SN if SN[n] == k]) for k, v in collections.Counter(v for v in SN.values() if v).items() if v > 1])
print('targets', len(out), 'named', named, 'snapped', snapped); json.dump(out, open('out/a320_targets.json', 'w'))
im = Image.open('out/a320_full.png').convert('RGB'); d = ImageDraw.Draw(im)
for n, (x, y, w, h, s) in out.items(): d.rectangle([x, y, x + w, y + h], outline=(255, 0, 255), width=3)
im.save('out/ovl_full.png')
for nm, bx in (('ovh', (1470, 1850, 3450, 3900)), ('aft', (1470, 0, 3450, 1900)), ('front', (0, 3940, 4920, 5560)), ('ped', (1590, 5600, 3330, 8258)), ('all', (0, 0, 4920, 8258))):
    c = im.crop(bx); k = min(1.0, 1700 / max(c.size)); c.resize((int(c.width * k), int(c.height * k)), Image.LANCZOS).save(f'out/ovl_{nm}.jpg', quality=85)
