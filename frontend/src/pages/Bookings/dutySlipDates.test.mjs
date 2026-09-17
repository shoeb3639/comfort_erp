import test from "node:test";
import assert from "node:assert/strict";
import { dutySlipDates, formatDutySlipDate } from "./dutySlipDates.js";

test("single-day log matches the booking date without a timezone shift", () => {
  assert.deepEqual(dutySlipDates("2026-09-12", "2026-09-12"), ["12/09/26"]);
  assert.deepEqual(dutySlipDates("2026-09-12T00:00:00.000Z"), ["12/09/26"]);
  assert.equal(formatDutySlipDate("2026-09-12"), "12/09/26");
});
test("includes both booking dates across month, leap-day and year boundaries", () => {
  assert.deepEqual(dutySlipDates("2026-09-30", "2026-10-02"), [
    "30/09/26",
    "01/10/26",
    "02/10/26",
  ]);
  assert.deepEqual(dutySlipDates("2028-02-28", "2028-03-01"), [
    "28/02/28",
    "29/02/28",
    "01/03/28",
  ]);
  assert.deepEqual(dutySlipDates("2026-12-31", "2027-01-01"), [
    "31/12/26",
    "01/01/27",
  ]);
});
test("rejects invalid or reversed calendar dates", () => {
  assert.deepEqual(dutySlipDates("2026-02-30"), []);
  assert.deepEqual(dutySlipDates("2026-09-12", "2026-09-11"), []);
});
