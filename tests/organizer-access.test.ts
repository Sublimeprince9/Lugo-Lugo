import assert from 'node:assert/strict';
import test from 'node:test';

import { isOrganizerEmailAllowed } from '../src/lib/organizer-access';

test('organizer allowlist matches normalized email addresses exactly', () => {
  assert.equal(
    isOrganizerEmailAllowed(' ORGANIZER@example.com ', 'admin@example.com, organizer@example.com'),
    true,
  );
  assert.equal(isOrganizerEmailAllowed('vendor@example.com', 'admin@example.com'), false);
  assert.equal(isOrganizerEmailAllowed(undefined, 'admin@example.com'), false);
});

test('organizer allowlist does not interpret wildcards or partial addresses', () => {
  assert.equal(isOrganizerEmailAllowed('admin@example.com', '*@example.com'), false);
  assert.equal(isOrganizerEmailAllowed('admin@example.com.attacker.test', 'admin@example.com'), false);
});
