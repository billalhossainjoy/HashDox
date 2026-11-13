import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnerEmail } from '../src/security/owner.ts';

test('owner is matched case-insensitively', () => {
  assert.equal(isOwnerEmail('Owner@Example.com', 'owner@example.com'), true);
});

test('owner identity ignores harmless surrounding whitespace', () => {
  assert.equal(isOwnerEmail(' owner@example.com ', 'OWNER@example.com '), true);
});

test('rejects another Google account', () => {
  assert.equal(isOwnerEmail('other@example.com', 'owner@example.com'), false);
});

test('fails closed when owner configuration is missing', () => {
  assert.equal(isOwnerEmail('owner@example.com', undefined), false);
  assert.equal(isOwnerEmail('owner@example.com', ''), false);
});

test('rejects empty or missing candidate emails', () => {
  assert.equal(isOwnerEmail('', 'owner@example.com'), false);
  assert.equal(isOwnerEmail(undefined, 'owner@example.com'), false);
});
