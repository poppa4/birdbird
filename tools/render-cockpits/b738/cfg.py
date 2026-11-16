ROOT = '/home/claude/fg/737-800YV'; XML = 'Models/cockpit.xml'; OUT = '/home/claude/rend/b738/b738.blend'
SKIP = r'seat|yoke|Human'
# dark cockpit: the lit copy of each annunciator and mode light is left out
HIDE = r'Models/Overhead/Overhead\.ac:.*\.off|.*Lit|Models/Instruments/autopilot-panel\.ac:(.*[A-Za-z/]2|N1-2|SPEED-2)'
# the model leaves the panel bodies plain white; a 737 flight deck is grey
G = (0.30, 0.31, 0.31); D = (0.05, 0.05, 0.055)
TINT = [(r'Models/cockpit\.ac:(dorrhfront|floor|cockpitdoor)', (0.10, 0.10, 0.11)), (r'Models/Overhead/Overhead\.ac:.*\.base', (0.03, 0.03, 0.032)), (r'Models/flightdesk\.ac:(Plane\.1088|Cube\.00[1267])', G), (r'Models/flightdesk\.ac:(sunshield.*|Tube\..*)', D), (r'Models/cockpit\.ac:(cabin_1|PanelLateral.*|.*sidepanel.*|Cube|lateral_couro)', (0.2, 0.2, 0.21))]

# unlit annunciators: the caption stays faintly readable, as on the real panel
DIM = r'.*\.on$'; DIMK = 0.33
