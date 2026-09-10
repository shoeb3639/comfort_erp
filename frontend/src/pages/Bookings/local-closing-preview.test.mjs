import test from "node:test";
import assert from "node:assert/strict";
import {
  localClosingPreview,
  overnightClosingDate,
} from "./local-closing-preview.mjs";
const booking = { startDate: "2026-09-11", duty_package: "local_12_120" };
test("uses package hours even when includedHours is missing", () => {
  const result = localClosingPreview(booking, {
    openingTime: "09:00",
    closingDate: "2026-09-11",
    closingTime: "23:00",
  });
  assert.equal(result.includedHours, 12);
  assert.equal(result.totalMinutes, 840);
  assert.equal(result.extraMinutes, 120);
});
test("handles seconds, timestamp dates, and overnight hours", () => {
  const result = localClosingPreview(
    { ...booking, startDate: "2026-09-11T00:00:00.000Z" },
    {
      openingTime: "20:00:00",
      closingDate: "2026-09-12",
      closingTime: "09:30:00",
    },
  );
  assert.equal(result.extraMinutes, 90);
});
test("distinguishes missing times from zero excess hours", () => {
  assert.equal(
    localClosingPreview(booking, { openingTime: "09:00" }).complete,
    false,
  );
  assert.equal(
    localClosingPreview(booking, {
      openingTime: "09:00",
      closingDate: "2026-09-11",
      closingTime: "21:00",
    }).extraMinutes,
    0,
  );
});

test("9 AM to midnight advances the date and calculates three extra hours", () => {
  const closingDate = overnightClosingDate(
    "2026-09-11",
    "2026-09-11",
    "09:00",
    "00:00",
  );
  assert.equal(closingDate, "2026-09-12");
  const result = localClosingPreview(booking, {
    openingTime: "09:00",
    closingDate,
    closingTime: "00:00",
  });
  assert.equal(result.totalMinutes, 900);
  assert.equal(result.extraMinutes, 180);
  assert.equal(
    overnightClosingDate("2026-09-11", "2026-09-13", "09:00", "00:00"),
    "2026-09-13",
  );
});
