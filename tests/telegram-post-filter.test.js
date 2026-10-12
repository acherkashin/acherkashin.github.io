import assert from "node:assert/strict";
import test from "node:test";

import {
  containsAdvertisingMarker,
  isAdvertisingPostGroup,
} from "../scripts/telegram/post-filter.js";

test("detects erid as a standalone word regardless of case or punctuation", () => {
  for (const value of ["erid", "ERID", "Реклама erid 123", "erid: 123", "(erid)"]) {
    assert.equal(containsAdvertisingMarker(value), true, value);
  }
});

test("detects Cyrillic ИНН as a standalone word regardless of case or punctuation", () => {
  for (const value of ["ИНН", "инн", "Реклама ИНН 123", "ИНН: 123", "(инн)"]) {
    assert.equal(containsAdvertisingMarker(value), true, value);
  }
});

test("does not detect markers embedded in other words or Latin INN", () => {
  for (const value of ["superid", "eridized", "Инна", "длинный", "INN"]) {
    assert.equal(containsAdvertisingMarker(value), false, value);
  }
});

test("treats a group as advertising when any message contains a marker", () => {
  const group = [
    { text: "Обычный текст и изображение" },
    { text: "Рекламная информация: erid 123" },
  ];

  assert.equal(isAdvertisingPostGroup(group), true);
});

test("keeps a group without standalone advertising markers", () => {
  const group = [
    { text: "История про Инну" },
    { text: "Очень длинный обычный пост" },
  ];

  assert.equal(isAdvertisingPostGroup(group), false);
});
