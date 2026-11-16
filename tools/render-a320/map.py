"""Map the A320 controls (measured in the reference frame, 1426 wide) onto the rendered sheet, section by section, with an
affine fit to anchors whose position on the sheet is computed from the 3D model itself."""
import sys, json, re, numpy as np; sys.path.insert(0, '/home/claude/rend'); import ac3d
m, O = ac3d.load('/home/claude/fg/A320-family/Models/FlightDeck/res/fd_complete.ac'); POS = json.load(open('out/a320_pos.json'))['pos']; PPM = 3000
def view(c, n, up, W, H):
    c, n, up = map(lambda v: np.array(v, float), (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); x = np.cross(up, -n); return c, x, up, W, H
V = {'ovh': view((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30), 'front': view((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.54),
     'ped': view((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886), 'sideL': view((-0.22, 0.08, 0.95), (0, -0.62, 0.78), (-1, 0, 0), 0.44, 0.40), 'sideR': view((-0.22, 0.08, -0.95), (0, -0.62, -0.78), (-1, 0, 0), 0.44, 0.40)}
def proj(v, p):
    c, x, up, W, H = V[v]; d = np.asarray(p) - c; return np.array([POS[v][0] + (d @ x + W / 2) * PPM, POS[v][1] + (H / 2 - d @ up) * PPM]).T
def obj(pat):
    P = [o['v'] for o in O if re.fullmatch(pat, o['name'])]
    if not P: raise KeyError(pat)
    return np.concatenate(P)
def centre(v, pat): q = proj(v, obj(pat)); return (q.min(0) + q.max(0)) / 2
def box(v, pat): q = proj(v, obj(pat)); return [*q.min(0), *(q.max(0) - q.min(0))]
if __name__ == '__main__':
    T = json.load(open('/tmp/a320_t.json')); K = 1.426; byn = {t[0]: t for t in T}
    def ref(n): t = byn[n]; return np.array([(t[1] + t[3] / 2) * K, (t[2] + t[4] / 2) * K])
    A = {'ovh': ('ovh', [('ADR 1', 'ADR1Btn.*'), ('ADR 2', 'ADR2Btn.*'), ('ELAC 2', 'ELAC2Btn.*'), ('BAT 1', 'BatteryBtn1.*'), ('L TK PUMP 1', 'LFuelTank1Btn.*'), ('R TK PUMP 2', 'RFuelTank2Btn.*'), ('ENG 1 BLEED', 'Eng1BleedBtn.*'), ('ENG 2 BLEED', 'Eng2BleedBtn.*'),
              ('WING A-ICE', 'WingAntiIceBtn.*'), ('APU START', 'APUStartBtn.*'), ('EXTRACT', 'VentExtractBtn.*'), ('TERR', 'GPWSTerrBtn.*'), ('ENG 2 AGENT 2', 'Eng2FireAgt2Btn.*'), ('ENG 1 AGENT 1', 'Eng1FireAgt1Btn.*'), ('IR 1', 'IR1Btn.*')]),
         'aft': ('ovh', [('DATA LOADER NEXT', 'DLSSysNextBtn'), ('DATA LOADER SEL', 'DLSSysSelCtlBtn'), ('TOILET', 'ToiletBtn.*')]),
         'glare': ('front', [('AP 1', 'ap1'), ('AP 2', 'ap2'), ('LOC', 'loc'), ('APPR', 'appr'), ('EXPED', 'exped'), ('A/THR', 'a-thr'), ('FD CPT', 'fd1'), ('FD F/O', 'fd2'), ('LS CPT', 'ils'), ('LS F/O', 'ils2')]),
         'main': ('front', [('AUTO BRK LO', 'abs_low'), ('AUTO BRK MAX', 'abs_max'), ('BRK FAN', 'brk_fan'), ('TERR ON ND CPT', 'terr_on_nd_l'), ('TERR ON ND F/O', 'terr_on_nd_r'), ('GPWS G/S CPT', r'gpws_gs_sw\.cpt'), ('GPWS G/S F/O', r'gpws_gs_sw\.fo')]),
         'ped': ('ped', [('ENG', 'ecam_eng'), ('FUEL', 'ecam_fuel'), ('CLR L', 'ecam_clr_l'), ('CLR', 'ecam_clr_r'), ('VHF 1', r'radio_vhf1\.cpt'), ('VHF 1 F/O', r'radio_vhf1\.fo'), ('BFO', r'radio_bfo\.cpt'), ('BFO F/O', r'radio_bfo\.fo'),
              ('VOICE', r'audio_voice\.cpt'), ('RESET F/O', r'audio_reset\.fo'), ('PWS', 'radar_pws'), ('RUD TRIM RESET', 'RudderTrimReset')])}
    AF = {}
    for s, (v, L) in A.items():
        X = []; Y = []
        for n, pat in L:
            try: X.append(ref(n)); Y.append(centre(v, pat))
            except KeyError as e: print('  missing', s, e)
        X = np.array(X); Y = np.array(Y); G = np.c_[X, np.ones(len(X))]
        if s == 'aft': G2 = G; M = None
        M, *_ = np.linalg.lstsq(G, Y, rcond=None); res = np.abs(G @ M - Y).max(0); AF[s] = M; print(s, len(X), 'scale', M[0, 0].round(4), M[1, 1].round(4), 'shear', M[0, 1].round(4), M[1, 0].round(4), 'max residual px', res.round(1))
    json.dump({k: v.tolist() for k, v in AF.items()}, open('out/affine.json', 'w'))
