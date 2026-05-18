ALTER TABLE "document_line_tracking" ADD COLUMN "serial_no" text;
--> statement-breakpoint
ALTER TABLE "document_line_tracking"
DROP CONSTRAINT "document_line_tracking_check",
ADD CONSTRAINT "document_line_tracking_check" CHECK (
  (
    serial_number_id IS NOT NULL
    AND serial_no IS NULL
    AND batch_no IS NULL
  )
  OR (
    serial_number_id IS NULL
    AND serial_no IS NOT NULL
    AND batch_no IS NULL
  )
  OR (
    serial_number_id IS NULL
    AND serial_no IS NULL
    AND batch_no IS NOT NULL
  )
);
