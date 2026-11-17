ROOT = '/home/claude/fg/DA40'; XML = 'Models/Interior/interior.xml'; OUT = '/home/claude/rend/da40/da40.blend'
# The aircraft takes its PFD bezel (GDU 1040) and audio panel (GMA 1347) from FlightGear's shared instruments (FGData,
# Aircraft/Instruments-3d/FG1000, GPL-2.0). They are copied to Models/Interior/Panel/Instruments/FG1000/ and panel-g1000.xml points there.
SKIP = r'^panel(/|$)|hobbs'
HIDE = r'window\..*'
