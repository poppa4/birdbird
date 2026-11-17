ROOT = '/home/claude/fg/SenecaII'; XML = 'Models/SenecaII.xml'; OUT = '/home/claude/rend/pa34/m/pa34m.blend'
# Shared instruments (altimeter, clock, DME indicator, KX 165, turn coordinator, VSI) come from FlightGear's FGData (Aircraft/Instruments-3d, GPL-2.0),
# copied into the aircraft folder; the hour meter comes from the c172p aircraft.
SKIP = r'SwitchPanel|PropDisc|Light|Strobe|Mirror|Pedals|Yoke'
HIDE = r'ThrottleControl.*|PropellerControl.*|MixtureControl.*|box.*|cylinder.*|Seat-.*|WindScreen|PilotWindow|RightFrontWindow|RightDoor|Chart'
