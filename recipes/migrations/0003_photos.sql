-- Photos of our own. A recipe's cover (image_url) used to be June's photo, shown from June's
-- server. Now it can also be a photo on this site (an address starting with /photos/), with
-- its own credit, and a recipe can have a gallery. Both are set by moderators, not the edit form.
--
-- image_credit: who took the cover photo ("June" for June's).
-- photos:       a JSON list of the gallery, [{"src": "/photos/<slug>/01.webp", "alt": "...",
--               "caption": "...", "width": 1400, "height": 788}], in order.

ALTER TABLE recipes ADD COLUMN image_credit TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN photos TEXT NOT NULL DEFAULT '';

UPDATE recipes SET image_credit = 'June' WHERE image_url LIKE 'https://recipe-media.juneoven.com/%';
