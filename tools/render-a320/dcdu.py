from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',22)
im=Image.new('RGB',(512,320),(6,9,12)); d=ImageDraw.Draw(im)
d.text((20,18),'NO ACTIVE ATC',font=F,fill=(40,220,240))
d.line((10,280,502,280),fill=(90,100,110),width=2)
d.text((20,288),'MSG',font=F,fill=(240,240,240)); im.save('scr/dcdu.png')
