ALTER TABLE "bookings"
ADD COLUMN "required_duty_documents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
