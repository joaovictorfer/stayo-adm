-- Administrative address regression: each expected address must have a matching
-- project and every matching project's structured address must agree.
WITH expected(label,pattern,street,number,district,city,cep) AS (VALUES
 ('Delle Alpi','%delle alpi%','Rua Oito de Abril','1158','São José','Canela','95683-572'),
 ('Ravena','%ravena%','Rua Visconde de Mauá','1233','Centro','Canela','95680-232'),
 ('Vêneto','%vêneto%','Rua Artur Reinheimer','550','Carniel','Gramado','95670-000'),
 ('Le Monde','%le monde%','Rua Dona Carlinda','500','Centro','Canela','95680-224'),
 ('Zagonel','%zagonel%','Avenida Borges de Medeiros','3375','Centro','Gramado','95670-000'),
 ('Mondeville','%mondeville%','Avenida Osvaldo Aranha','251','Centro','Canela','95680-079'),
 ('Laje de Pedra','%laje de pedra%','Rua Conceição','66','Laje de Pedra','Canela','95680-000'))
SELECT e.label, 1 / CASE WHEN count(p.id)>0 AND bool_and(
 p.address IS NOT DISTINCT FROM e.street||', '||e.number||' – '||e.district
 AND p.city IS NOT DISTINCT FROM e.city AND p.postal_code IS NOT DISTINCT FROM e.cep
 AND d.street IS NOT DISTINCT FROM e.street AND d.number IS NOT DISTINCT FROM e.number
 AND d.district IS NOT DISTINCT FROM e.district AND d.city IS NOT DISTINCT FROM e.city
 AND d.state IS NOT DISTINCT FROM 'RS' AND d.postal_code IS NOT DISTINCT FROM e.cep
) THEN 1 ELSE 0 END AS passed
FROM expected e LEFT JOIN public.implementation_projects p
 ON lower(coalesce(p.condominium_name,'')||' | '||coalesce(p.nickname,'')) LIKE e.pattern
LEFT JOIN public.implementation_property_details d ON d.implementation_id=p.id
GROUP BY e.label ORDER BY e.label;