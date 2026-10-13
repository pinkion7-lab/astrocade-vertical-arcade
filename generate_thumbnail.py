from PIL import Image, ImageDraw, ImageFilter
import math

WIDTH, HEIGHT = 480, 800
DURATION = 90
FRAMES = []

for frame in range(30):
    img = Image.new('RGB', (WIDTH, HEIGHT), (8, 15, 30))
    draw = ImageDraw.Draw(img)

    for y in range(0, HEIGHT, 12):
        alpha = (y / HEIGHT) * 255
        color = (24 + y // 18, 18 + y // 16, 36 + y // 12)
        draw.rectangle((0, y, WIDTH, y + 12), fill=color)

    for i in range(60):
        x = (i * 59 + frame * 3) % (WIDTH + 20)
        y = (i * 31) % HEIGHT
        r = 1 + (i % 3)
        draw.ellipse((x, y, x + r, y + r), fill=(170, 210, 255, 255))

    for i in range(12):
        px = 30 + i * 36
        py = HEIGHT - 110
        tower_h = 120 + (i % 5) * 20
        draw.rectangle((px, py - tower_h, px + 22, py), fill=(16, 28, 48))
        draw.rectangle((px + 4, py - tower_h + 10, px + 18, py - 8), fill=(84, 146, 255))

    cx = WIDTH / 2
    cy = HEIGHT * 0.72
    for step in range(0, 180, 18):
        rr = 70 + step * 1.2
        alpha = int(255 * (1 - step / 200))
        color = (110, 200, 255, alpha)
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(100, 180, 255), width=2)

    player_x = WIDTH * 0.5 + math.sin(frame / 8) * 70
    player_y = HEIGHT * 0.8
    draw.ellipse((player_x - 26, player_y - 26, player_x + 26, player_y + 26), fill=(125, 245, 255))
    draw.polygon([(player_x, player_y - 40), (player_x + 24, player_y + 18), (player_x, player_y + 10), (player_x - 24, player_y + 18)], fill=(210, 245, 255))

    for i in range(8):
        gx = 60 + i * 48 + (frame * (1 + i % 3)) % 24
        gy = 120 + i * 52
        draw.polygon([(gx, gy), (gx + 10, gy - 18), (gx + 20, gy)], fill=(132, 248, 216))

    for i in range(12):
        x = 40 + i * 35 + (frame * 2) % 18
        y = 240 + (i % 4) * 70 + ((frame * 7 + i * 12) % 16)
        draw.ellipse((x, y, x + 10, y + 10), fill=(255, 202, 92))

    draw.text((WIDTH // 2 - 90, 60), 'AURORA', fill=(255, 255, 255), anchor='la')
    draw.text((WIDTH // 2 + 18, 60), 'VAULT', fill=(133, 220, 255), anchor='la')

    for a in range(0, 360, 50):
        x = WIDTH / 2 + math.cos(math.radians(a + frame * 2)) * 140
        y = HEIGHT * 0.2 + math.sin(math.radians(a + frame * 2)) * 90
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(146, 219, 255))

    draw.rectangle((20, HEIGHT - 60, WIDTH - 20, HEIGHT - 30), fill=(20, 26, 38), outline=(90, 124, 196))
    draw.rectangle((42, HEIGHT - 52, WIDTH - 42, HEIGHT - 38), fill=(113, 198, 255))
    FRAMES.append(img)

# Save as GIF
first = FRAMES[0]
first.save(
    'thumbnail.gif',
    save_all=True,
    append_images=FRAMES[1:],
    duration=70,
    loop=0,
    optimize=True,
    disposal=2,
)
print('thumbnail.gif generated')
