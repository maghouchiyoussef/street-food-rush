# Credits & asset sources

Every asset in Street Food Rush is original. Nothing is copied from another game
(no names, logos, models, sounds or interface from any existing game).

## Generated with Higgsfield (owner's Pro account, commercial use under the account's plan)
| Asset | File | Tool / model |
|---|---|---|
| Chef mascot artwork (title screen, app icon, splash) | `art/concepts/chef2.jpg` → `www/img/chef.png`, icons | Higgsfield image (gpt_image_2_5) |
| Customer character, rigged + walk animation (8 outfits recolored in code: `src/outfits.ts`) | `www/models/customer.glb` (concept `art/concepts/cust1.jpg`) | Higgsfield image → Meshy Image-to-3D (texture, rigging, Casual_Walk) |
| Hot dog cart 3D (not used in game yet) | `art/models/cart_sam.glb`, `art/models/cart_tripo.glb` | Higgsfield image → SAM 3 3D / Tripo H3.1 |
| New York style street background | `www/img/nyc.jpg` | Higgsfield image (gpt_image_2_5) |

All prompts asked for generic designs: no text, no logos, no brands.

## Made in code (this repository)
- Food (sausages, buns, sauces, cups), the counter, grill, crates, bottles, soda machine, awning: `src/food.ts`, `src/scene.ts`
- All sounds and music: generated with Web Audio in `src/audio.ts` (no sound files)
- App icon / splash composition: `tools/make_icons.py`

## Libraries
- three.js (MIT), Capacitor (MIT)
- Emoji in the order bubbles are rendered by the phone's system font.
