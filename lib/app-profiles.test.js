const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAppProfile,
  findOrAddAppProfile,
  updateAppProfile,
  removeAppProfile
} = require('./app-profiles');

test('validateAppProfile enforces name and logo', () => {
  assert.equal(validateAppProfile(null).valid, false);
  assert.equal(validateAppProfile({ name: '', icon: '/logo.png' }).valid, false);
  assert.equal(validateAppProfile({ name: 'Speed Cash', icon: '' }).valid, false);
  assert.equal(
    validateAppProfile({ name: 'Speed Cash', icon: 'https://example.com/logo.png' }).valid,
    true
  );
});

test('findOrAddAppProfile adds new profile and avoids duplicate names', () => {
  const list = [
    { id: 'zen-money', name: 'Zen Money', icon: '/assets/zen-money.svg' }
  ];

  // Add brand new profile
  const result1 = findOrAddAppProfile(list, {
    name: 'Karta Loan',
    icon: '/assets/karta-loan.svg'
  });
  assert.equal(result1.added, true);
  assert.equal(list.length, 2);
  assert.equal(list[1].name, 'Karta Loan');

  // Attempting to add existing profile by name (case-insensitive)
  const result2 = findOrAddAppProfile(list, {
    name: 'zen money',
    icon: '/assets/zen-money.svg'
  });
  assert.equal(result2.added, false);
  assert.equal(list.length, 2);
});

test('updateAppProfile modifies name or logo URL correctly', () => {
  const list = [
    { id: 'app_1', name: 'Old App', icon: '/old.png' }
  ];

  const updateResult = updateAppProfile(list, 'app_1', {
    name: 'New App Name',
    icon: 'https://cdn.example.com/new-logo.png'
  });

  assert.equal(updateResult.success, true);
  assert.equal(list[0].name, 'New App Name');
  assert.equal(list[0].icon, 'https://cdn.example.com/new-logo.png');
});

test('removeAppProfile removes profile from list so only explicitly removed items are out of list', () => {
  const list = [
    { id: 'app_1', name: 'App 1', icon: '/1.png' },
    { id: 'app_2', name: 'App 2', icon: '/2.png' }
  ];

  const res = removeAppProfile(list, 'app_1');
  assert.equal(res.success, true);
  assert.equal(res.logos.length, 1);
  assert.equal(res.logos[0].id, 'app_2');
});
