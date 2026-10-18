DO $migration$ DECLARE def text; BEGIN
SELECT pg_get_functiondef('public.field_registration_prepare_inventory(text)'::regprocedure) INTO def;
def := replace(def, 'FROM jsonb_array_elements(v_rooms) room WHERE amenity_key=''r:''||(room->>''id'')||'':camas''', 'FROM jsonb_array_elements(v_rooms) AS e(value) WHERE amenity_key=''r:''||(e.value->>''id'')||'':camas''');
EXECUTE def;
END $migration$;