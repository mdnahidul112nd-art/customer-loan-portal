/**
 * Pure logic for managing field visibility settings (HIDE/SHOW)
 */

const VISIBLE_FIELDS = [
  'customerName',
  'remainingAmount',
  'loanAmount',
  'receivedAmount',
  'bankAddress',
  'amountPaid',
  'overdueDays',
  'lateFee',
  'dates',
  'upiId'
];

const DEFAULT_VISIBILITY = Object.freeze(
  VISIBLE_FIELDS.reduce((acc, field) => {
    acc[field] = true;
    return acc;
  }, {})
);

function normalizeVisibility(input) {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_VISIBILITY };
  }

  const result = {};
  for (const field of VISIBLE_FIELDS) {
    const val = input[field];
    if (val === false || val === 'false' || val === 'hide' || val === 0) {
      result[field] = false;
    } else {
      result[field] = true;
    }
  }
  return result;
}

function isFieldVisible(visibility, field) {
  const norm = normalizeVisibility(visibility);
  return norm[field] !== false;
}

module.exports = {
  VISIBLE_FIELDS,
  DEFAULT_VISIBILITY,
  normalizeVisibility,
  isFieldVisible
};
