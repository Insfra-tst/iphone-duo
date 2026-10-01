from PIL import Image, ImageDraw
import os
from pathlib import Path

# Create icons directory if it doesn't exist
output_dir = Path(__file__).resolve().parents[1] / 'web' / 'icons'
output_dir.mkdir(parents=True, exist_ok=True)

# Create simple gradient icons
sizes = [32, 40, 58, 60, 72, 80, 87, 96, 120, 128, 144, 152, 180, 192, 384, 512, 1024]

for size in sizes:
    # Create a new image with gradient background
    img = Image.new('RGB', (size, size), '#667eea')
    draw = ImageDraw.Draw(img)

    # Draw gradient effect
    for i in range(size):
        alpha = i / size
        color = (
            int(102 + (118 - 102) * alpha),  # R: 667eea to 764ba2
            int(126 + (75 - 126) * alpha),   # G
            int(234 + (162 - 234) * alpha)   # B
        )
        draw.rectangle([i, 0, i+1, size], fill=color)

    # Add a simple geometric AI symbol
    margin = size // 4
    center = size // 2

    # Draw outer circle (white)
    draw.ellipse([margin, margin, size-margin, size-margin], fill='white')

    # Draw inner circle (gradient color)
    inner_margin = margin + size // 16
    draw.ellipse([inner_margin, inner_margin, size-inner_margin, size-inner_margin], fill='#667eea')

    # Draw AI dots pattern
    dot_size = size // 20
    positions = [
        (center - dot_size*2, center - dot_size),
        (center, center - dot_size),
        (center + dot_size*2, center - dot_size),
        (center - dot_size, center + dot_size),
        (center + dot_size, center + dot_size)
    ]

    for x, y in positions:
        draw.ellipse([x-dot_size//2, y-dot_size//2, x+dot_size//2, y+dot_size//2], fill='white')

    # Save the image
    img.save(output_dir / f'icon-{size}.png')

print('Icons generated successfully!')
