# Local booking closing

Local bookings require start/closing odometers plus a closing date and time.
Opening time defaults to the pickup time and is editable. The opening date is
shown in the booking summary. Enter the next closing date for overnight trips.
Times are interpreted as local civil times in the booking's service location.

The selected `local_HOURS_KM` package supplies the included limits. For a
12-hour / 120-km package with 185 actual km and 14 hours, excess usage is 65 km
and 2 hours. Closing lets the manager set the per-extra-km and per-extra-hour
rates. Rates are required when applicable excess exists; explicitly enter zero
to waive a charge. Fractional hours are prorated by minutes, with final amounts
rounded to paise. Under-limit usage never creates negative extras.

Package-based billing adds excess kilometres and hours to the package price.
Kilometre-based billing already charges its billing kilometres, so only excess
hour charges are added; there is no second charge for extra kilometres.
Local bookings without a recorded package have no assumed included limits or
automatic excess charges. Other booking types retain their existing closing flow.

The server independently calculates and stores an immutable closing snapshot in
`booking_closures.local_package_billing`. The invoice has separate Extra Kilometres
and Extra Hours lines; their amounts are included once in total billing, customer
outstanding and own/vendor profit. Vendor payable remains separately entered.
Booking View shows the recorded closing time, duration and excess charges.

Apply `20260911120000_local_package_closing` and regenerate Prisma Client.
Historical closures keep a null snapshot and are not recalculated.
