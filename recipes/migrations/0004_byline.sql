-- "Recipe by": who the recipe is from, shown under the title and on its card, so a name doesn't
-- have to go in the title. An editable field like the others (it's in every revision too).
ALTER TABLE recipes ADD COLUMN byline TEXT NOT NULL DEFAULT '';
