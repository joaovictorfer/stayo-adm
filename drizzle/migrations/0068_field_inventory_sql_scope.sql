DO $migration$ DECLARE def text; BEGIN
SELECT pg_get_functiondef('public.field_registration_prepare_inventory(text)'::regprocedure) INTO def;
def := replace(def, 'DECLARE l public.implementation_field_links;', E'#variable_conflict use_column\nDECLARE l public.implementation_field_links;');
EXECUTE def;
END $migration$;