ALTER TABLE public.property_history_events ADD CONSTRAINT history_checked_requires_received CHECK(checked_qty IS NULL OR received_qty IS NOT NULL);
CREATE OR REPLACE FUNCTION public.guard_history_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_category text;
BEGIN
 SELECT category INTO v_category FROM public.property_history_cases WHERE id=NEW.case_id;
 IF v_category='compra' AND NEW.status='concluido' AND (NEW.expected_qty IS NULL OR NEW.expected_qty<=0 OR NEW.checked_qty IS DISTINCT FROM NEW.expected_qty OR NEW.received_qty IS DISTINCT FROM NEW.expected_qty) THEN RAISE EXCEPTION 'Confira toda a quantidade antes de concluir a compra'; END IF;
 IF NEW.status='cancelado' AND length(btrim(NEW.description))=0 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_property_history_event BEFORE INSERT ON public.property_history_events FOR EACH ROW EXECUTE FUNCTION public.guard_history_event();
CREATE OR REPLACE FUNCTION public.history_command_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.request_id::text,0));
 IF EXISTS(SELECT 1 FROM public.property_history_events WHERE request_id=NEW.request_id) THEN RAISE EXCEPTION 'Registro já salvo. Recarregue o histórico.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER history_command_serialization BEFORE INSERT ON public.property_history_events FOR EACH ROW EXECUTE FUNCTION public.history_command_lock();
CREATE OR REPLACE FUNCTION public.supply_items_timeline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
COMMENT ON FUNCTION public.supply_items_timeline() IS 'DEPRECATED: new supply changes are recorded transactionally by capture_supply_history; previous implementation timeline rows are preserved.';