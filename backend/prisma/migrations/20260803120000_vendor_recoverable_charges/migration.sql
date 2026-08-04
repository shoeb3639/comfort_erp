-- Pass toll, parking and driver allowance through to the vendor while
-- preserving the previously calculated vendor margin on historical closures.
UPDATE "booking_closures" AS closure
SET
  "final_vendor_payable" = GREATEST(
    0,
    closure."vendor_payable_amount"
      + closure."toll_tax"
      + closure."parking"
      + closure."driver_allowance"
      + closure."vendor_extra_charges"
      - closure."vendor_deduction"
  ),
  "vendor_booking_profit" =
    closure."base_fare"
      + closure."toll_tax"
      + closure."parking"
      + closure."driver_allowance"
      - GREATEST(
          0,
          closure."vendor_payable_amount"
            + closure."toll_tax"
            + closure."parking"
            + closure."driver_allowance"
            + closure."vendor_extra_charges"
            - closure."vendor_deduction"
        )
FROM "bookings" AS booking
WHERE booking."id" = closure."booking_id"
  AND booking."tenant_id" = closure."tenant_id"
  AND booking."assignment_source" = 'VENDOR';
