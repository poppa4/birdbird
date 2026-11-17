ROOT = '/home/claude/fg/737-MAX'; XML = 'Models/Cockpit/cockpit.xml'; OUT = '/home/claude/rend/b38m/b38m.blend'
SKIP = r'(?!)'
HIDE = r'ap\..*-engage|seat\..*|column\..*|clipboard\..*|door|windshield|handle|Sphere.*|yoke.*'
# the model leaves panel bodies plain white; a 737 flight deck is grey
G = (0.27, 0.28, 0.28)
TINT = [(r'Models/Cockpit/cockpit\.ac:(frame.*|light\.base|pedestal.*|ap\.glareshield|shell)', G)]
