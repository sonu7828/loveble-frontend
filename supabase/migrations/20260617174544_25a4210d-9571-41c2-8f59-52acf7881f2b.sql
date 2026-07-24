
-- Deactivate the three June Specials shown
UPDATE public.services SET is_active = false
WHERE id IN (
  '5a000006-0000-0000-0000-000000000a01',
  '5a000006-0000-0000-0000-000000000a02',
  '5a000006-0000-0000-0000-000000000a03'
);

-- Add packages of 3 and 6 for Lasers and Skin Tightening
INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, display_order, is_active)
VALUES
-- Lasers (cat 0007)
('57000000-0000-0000-0000-000000000101','c1000000-0000-0000-0000-000000000007','IPL — Package of 3','Three IPL photofacial sessions. Save 10% vs single-session pricing. Best for redness, sun damage, and overall tone.',45,81000,'$810 (save $90) · 3 sessions',101,true),
('57000000-0000-0000-0000-000000000102','c1000000-0000-0000-0000-000000000007','IPL — Package of 6','Six IPL photofacial sessions. Save 15% vs single-session pricing.',45,153000,'$1,530 (save $270) · 6 sessions',102,true),
('57000000-0000-0000-0000-000000000103','c1000000-0000-0000-0000-000000000007','Nd:YAG Laser — Package of 3','Three Nd:YAG sessions for vascular lesions, redness, or deeper pigment. Save 10%.',45,81000,'$810 (save $90) · 3 sessions',103,true),
('57000000-0000-0000-0000-000000000104','c1000000-0000-0000-0000-000000000007','Nd:YAG Laser — Package of 6','Six Nd:YAG sessions. Save 15%.',45,153000,'$1,530 (save $270) · 6 sessions',104,true),
('57000000-0000-0000-0000-000000000105','c1000000-0000-0000-0000-000000000007','Pico Laser — Package of 3','Three Pico Laser sessions for pigment, melasma, and tone correction. Save 10%.',45,94500,'$945 (save $105) · 3 sessions',105,true),
('57000000-0000-0000-0000-000000000106','c1000000-0000-0000-0000-000000000007','Pico Laser — Package of 6','Six Pico Laser sessions. Save 15%.',45,178500,'$1,785 (save $315) · 6 sessions',106,true),
('57000000-0000-0000-0000-000000000107','c1000000-0000-0000-0000-000000000007','CO₂ Laser — Package of 3','Three CO₂ resurfacing sessions for deep texture, scars, and rejuvenation. Save 10%.',60,162000,'$1,620 (save $180) · 3 sessions',107,true),
-- Skin Tightening (cat 0006)
('56000000-0000-0000-0000-000000000101','c1000000-0000-0000-0000-000000000006','Exilis Ultra 360 — Package of 3','Three Exilis Ultra 360 sessions for skin tightening and contouring. Save 10%.',45,67500,'$675 (save $75) · 3 sessions',101,true),
('56000000-0000-0000-0000-000000000102','c1000000-0000-0000-0000-000000000006','Exilis Ultra 360 — Package of 6','Six Exilis Ultra 360 sessions. Save 15%.',45,127500,'$1,275 (save $225) · 6 sessions',102,true),
('56000000-0000-0000-0000-000000000103','c1000000-0000-0000-0000-000000000006','Volnewmer (Monopolar RF) — Package of 3','Three Volnewmer full-face sessions. Premium monopolar RF tightening. Save 10%.',60,202500,'$2,025 (save $225) · 3 sessions · full face',103,true),
('56000000-0000-0000-0000-000000000104','c1000000-0000-0000-0000-000000000006','Volnewmer (Monopolar RF) — Package of 6','Six Volnewmer full-face sessions. Save 15%.',60,382500,'$3,825 (save $675) · 6 sessions · full face',104,true);
