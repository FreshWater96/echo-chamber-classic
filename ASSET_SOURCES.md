# Echo Chamber — visual rebuild

The browser game uses Three.js 0.180.0, bundled locally. Original rooms, furniture meshes, lighting, shaders, sound synthesis, and game logic are authored for Echo Chamber.

## Reference
Withering Rooms by Moonless Formless was used as a reference for side-on room framing, environmental depth, the restrained interface, and dark institutional atmosphere. No game assets, characters, audio, or code from Withering Rooms are included.

## Surface textures
Poly Haven, CC0:
- public/assets/wall-*.jpg: Plastered Wall 03 — https://polyhaven.com/a/plastered_wall_03
- public/assets/floor-*.jpg: Wood Floor Worn — https://polyhaven.com/a/wood_floor_worn

## Original character art
Created with the built-in image generation tool, as transparent 4 by 2 walk-cycle atlases:
- /workspace/sites/echo-chamber/public/assets/drifter-atlas.png
- /workspace/sites/echo-chamber/public/assets/listener-atlas.png

Final Drifter prompt: Original adult female laboratory survivor in side profile facing right; dark auburn bob, stained off-white knee-length laboratory coat over charcoal trousers, dark scarf, scuffed black shoes, handheld brass acoustic scanner. Realistic painterly game-render aesthetic, desaturated colors. Eight sequential low-arc walk poses in a consistent 4 by 2 transparent atlas. Same anatomy, clothes, scale, framing, foot baseline, and right-facing orientation. No scenery, labels, borders, logos, or floor shadows.

Final Listener prompt: Original elongated hunched ashen humanoid in side profile facing right, eyeless narrow skull, asymmetrical cup-shaped ears, long forearms dragging on knuckles, thin bent legs, dark ragged restraint apron, bare bony feet. Non-graphic horror without blood or exposed organs. Realistic painterly game-render aesthetic, bone gray and charcoal. Eight consistent knuckle-walk poses in a 4 by 2 transparent atlas. No scenery, labels, borders, logos, or floor shadows.

The atlases are normalized into consistent frames at runtime, and rendered as animated cutout meshes inside the Three.js environment.
