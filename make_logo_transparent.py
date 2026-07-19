import os
from PIL import Image

def make_transparent(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # item is (r, g, b, a)
        r, g, b, a = item
        # If the pixel is very dark (close to black), make it transparent
        # We can calculate the brightness or check individual channel thresholds.
        # Since the background is black, we can check if r, g, b are all below a threshold.
        threshold = 20
        if r < threshold and g < threshold and b < threshold:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(out_path, "PNG")
    print(f"Saved transparent image to {out_path}")

make_transparent("public/pravrutti-logo.jpeg", "public/pravrutti-logo.png")
