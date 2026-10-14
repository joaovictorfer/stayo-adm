DO $do$
DECLARE d text; n text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='admin_save_proposal_draft';
  n := replace(d, $a$'scope', q.scope
    )$a$, $a$'scope', q.scope,
      'paid', q.paid,
      'paidAt', q.paid_at
    )$a$);
  n := replace(n, $a$), '[]'::jsonb) AS scope
      FROM jsonb_array_elements(v_items_input)$a$, $a$), '[]'::jsonb) AS scope,
        coalesce((value->>'paid')::boolean, false) AS paid,
        CASE WHEN coalesce((value->>'paid')::boolean, false) THEN nullif(left(coalesce(value->>'paidAt', ''), 10), '') END AS paid_at
      FROM jsonb_array_elements(v_items_input)$a$);
  n := replace(n, $a$'templateKey', nullif(left(coalesce(value->>'templateKey', ''), 60), ''),$a$, $a$'templateKey', nullif(left(coalesce(value->>'templateKey', ''), 60), ''),
      'paid', coalesce((value->>'paid')::boolean, false),
      'paidAt', CASE WHEN coalesce((value->>'paid')::boolean, false) THEN nullif(left(coalesce(value->>'paidAt', ''), 10), '') END,$a$);
  IF n = d OR position('q.paid_at' in n) = 0 THEN RAISE EXCEPTION 'patch not applied'; END IF;
  EXECUTE n;
END $do$;