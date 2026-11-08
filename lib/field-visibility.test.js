const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VISIBLE_FIELDS,
  DEFAULT_VISIBILITY,
  normalizeVisibility,
  isFieldVisible
} = require('./field-visibility');

test('DEFAULT_VISIBILITY has all 10 fields enabled by default', () => {
  assert.equal(VISIBLE_FIELDS.length, 10);
  for (const field of VISIBLE_FIELDS) {
    assert.equal(DEFAULT_VISIBILITY[field], true);
  }
});

test('normalizeVisibility parses booleans and strings correctly', () => {
  const custom = {
    customerName: false,
    remainingAmount: 'false',
    bankAddress: 'hide',
    loanAmount: true,
    upiId: false
  };

  const normalized = normalizeVisibility(custom);
  assert.equal(normalized.customerName, false);
  assert.equal(normalized.remainingAmount, false);
  assert.equal(normalized.bankAddress, false);
  assert.equal(normalized.loanAmount, true);
  assert.equal(normalized.receivedAmount, true); // untouched field defaults to true
  assert.equal(normalized.upiId, false);
});

test('isFieldVisible returns true for shown fields and false for hidden fields', () => {
  const vis = {
    overdueDays: false,
    lateFee: false
  };

  assert.equal(isFieldVisible(vis, 'overdueDays'), false);
  assert.equal(isFieldVisible(vis, 'lateFee'), false);
  assert.equal(isFieldVisible(vis, 'dates'), true);
  assert.equal(isFieldVisible(vis, 'customerName'), true);
});
