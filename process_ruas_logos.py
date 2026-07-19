from PIL import Image

def make_logo_transparent(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # The alpha is proportional to the maximum brightness of the pixel
            alpha = max(r, g, b)
            
            if alpha > 0:
                # Unmultiply alpha to get the original color
                new_r = min(255, int(r * 255 / alpha))
                new_g = min(255, int(g * 255 / alpha))
                new_b = min(255, int(b * 255 / alpha))
                
                # Soft threshold for clean low-end transparency
                if alpha < 25:
                    soft_alpha = int(alpha * (alpha / 25))
                    pixels[x, y] = (new_r, new_g, new_b, soft_alpha)
                else:
                    pixels[x, y] = (new_r, new_g, new_b, alpha)
            else:
                pixels[x, y] = (0, 0, 0, 0)
                
    img.save(out_path, "PNG")
    print(f"Processed transparent logo saved to {out_path}")

make_logo_transparent("public/ruas-logo-color.png", "public/ruas-logo-color-trans.png")
make_logo_transparent("public/ruas-logo-white.png", "public/ruas-logo-white-trans.png")
