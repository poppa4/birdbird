ROOT = '/home/claude/fg/Beechcraft-King-Air'; XML = 'Models/kingair.xml'; OUT = '/home/claude/rend/b200/b200.blend'
SKIP = r'all-pilots|all-seats|all-lights|all-yokes|Effects|Immat|Pilot'
HIDE = r'Models/kingair\.ac:.*|Models/Interior/interior\.ac:.*|vitre|.*\.vitre'
# the beige panels are a little deeper than in the model, so their white lettering can be read in the picture
TINT = [(r'Models/Interior/Panel/panel\.ac:(panel|cover|texte)', (0.55, 0.55, 0.55)), (r'Models/Interior/Panel/Overhead/overhead\.ac:overhead', (0.5, 0.5, 0.5))]
