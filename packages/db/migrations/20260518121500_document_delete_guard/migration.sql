-- Prevent hard-deletes for protected financial document types.
-- The application still attempts the delete; Postgres now enforces the rule.

CREATE OR REPLACE FUNCTION public.prevent_protected_document_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.document_type IN ('R', 'G', 'r', 'g') THEN
    RAISE EXCEPTION 'Documents of type % cannot be deleted', OLD.document_type
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_prevent_protected_document_delete ON "document";
--> statement-breakpoint
CREATE TRIGGER trg_prevent_protected_document_delete
BEFORE DELETE ON "document"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_protected_document_delete();
