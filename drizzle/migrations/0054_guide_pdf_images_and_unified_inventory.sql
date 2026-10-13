CREATE TEMP TABLE _img(name text, img text) ON COMMIT DROP;
INSERT INTO _img VALUES
('talheres','talheres'),('copos de vidro','copos'),('taças de vinho','tacas-vinho'),('taças de espumante','tacas-espumante'),
('jogo de jantar','jogo-jantar'),('xícaras de café com pires','xicaras'),('kit de utensílios','kit-utensilios'),
('jogo de panelas antiaderentes','panelas'),('kit pirex / refratários para forno','pirex'),('jogo de potes com tampa','potes'),
('tapetes antiderrapantes','tapetes'),('jogo americano ou sousplat','sousplat'),('purificador de água','purificador'),
('luva térmica / descanso de panela','luva-termica'),('forma de bolo / assadeira retangular','forma-bolo'),
('abridor de vinho e garrafa','abridor'),('torradeira','torradeira'),('chaleira elétrica','chaleira'),
('liquidificador','liquidificador'),('cafeteira elétrica','cafeteira'),('escorredor de louças','escorredor'),
('dispenser para detergente + suporte de esponja','dispenser'),('pá de lixo + vassourinha','pa-lixo'),
('tábua de corte dupla face','tabua'),('kit churrasco','kit-churrasco'),('espetos','espetos'),('cabides','cabides'),
('ferro de passar roupa','ferro'),('porta sabonete líquido de mão','porta-sabonete'),
('lixeira de banheiro com tampa','lixeira-banheiro'),('secador de cabelo','secador'),('panos de prato','panos-prato'),('canecas','canecas');

INSERT INTO public.guide_catalog_items (guide_type, category, name, recommended_quantity, quantity_text, description, classification, display_order)
SELECT 'utensilios','Cozinha','Canecas',6,'6 unidades','Estilo clean, cores neutras ou tons terrosos.','recomendado',65
WHERE NOT EXISTS (SELECT 1 FROM public.guide_catalog_items WHERE guide_type='utensilios' AND lower(name)='canecas');

UPDATE public.guide_catalog_items c SET image_path = 'catalog/pdf/'||i.img||'.jpg',
  tip = CASE WHEN c.category='Cozinha' AND coalesce(c.tip,'')='' THEN 'Recomendamos comprar na Havan pela facilidade de reposição. Em caso de item danificado, a reposição fica mais simples.' ELSE c.tip END
FROM _img i WHERE c.guide_type='utensilios' AND lower(btrim(c.name))=i.name;

-- itens equivalentes já existentes no inventário recebem os dados do guia
CREATE TEMP TABLE _ren(old text, new text, room text) ON COMMIT DROP;
INSERT INTO _ren VALUES ('talheres','talheres','cozinha'),('torradeira','torradeira','cozinha'),('chaleira','chaleira elétrica','cozinha'),
('cafeteira','cafeteira elétrica','cozinha'),('taças','taças de vinho','cozinha'),('pratos','jogo de jantar','cozinha'),
('panela','jogo de panelas antiaderentes','cozinha'),('secador','secador de cabelo','banheiros'),('lixeira','lixeira de banheiro com tampa','banheiros');

UPDATE public.guide_catalog_items inv SET name=u.name, recommended_quantity=u.recommended_quantity, quantity_text=u.quantity_text,
  description=u.description, tip=u.tip, image_path=u.image_path, classification=u.classification
FROM _ren r JOIN public.guide_catalog_items u ON u.guide_type='utensilios' AND lower(btrim(u.name))=r.new
WHERE inv.guide_type='inventario' AND inv.room=r.room AND lower(btrim(inv.name))=r.old;

INSERT INTO public.guide_catalog_items (guide_type, category, name, recommended_quantity, quantity_text, size_text, description, tip, purchase_url, image_path, classification, display_order, room)
SELECT 'inventario', CASE u.category WHEN 'Cozinha' THEN 'Utensílios' WHEN 'Quartos' THEN 'Acessórios' ELSE 'Acessórios' END,
  u.name, u.recommended_quantity, u.quantity_text, u.size_text, u.description, u.tip, u.purchase_url, u.image_path, u.classification,
  100 + u.display_order, lower(u.category)
FROM public.guide_catalog_items u
WHERE u.guide_type='utensilios' AND u.active AND NOT EXISTS (
  SELECT 1 FROM public.guide_catalog_items x WHERE x.guide_type='inventario' AND x.room=lower(u.category) AND lower(btrim(x.name))=lower(btrim(u.name)));

-- propaga fotos/dicas às implantações já existentes (não mexe em respostas)
UPDATE public.implementation_guide_items g SET image_path=c.image_path, description=coalesce(g.description,c.description),
  tip=coalesce(g.tip,c.tip), quantity_text=coalesce(g.quantity_text,c.quantity_text),
  name = CASE WHEN EXISTS (SELECT 1 FROM _ren r WHERE lower(btrim(g.name))=r.old) THEN c.name ELSE g.name END
FROM public.guide_catalog_items c WHERE g.catalog_item_id=c.id AND c.image_path IS NOT NULL AND g.image_path IS NULL;