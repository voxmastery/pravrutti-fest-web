from PIL import Image

def extract_transparent_logo(img_path, out_path):
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
                
                # Apply a slight soft threshold to clean up very dark noise pixels
                if alpha < 20:
                    # Fade out smoothly at the lowest end
                    soft_alpha = int(alpha * (alpha / 20))
                    pixels[x, y] = (new_r, new_g, new_b, soft_alpha)
                else:
                    pixels[x, y] = (new_r, new_g, new_b, alpha)
            else:
                pixels[x, y] = (0, 0, 0, 0)
                
    img.save(out_path, "PNG")
    print(f"Successfully generated high-quality transparent logo: {out_path}")

extract_transparent_logo("public/pravrutti-logo.jpeg", "public/pravrutti-logo.png")
