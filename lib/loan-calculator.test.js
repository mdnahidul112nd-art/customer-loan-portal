const test = require('node:test');
const assert = require('node:assert');
const {
  parseDate,
  formatDate,
  calculateDueDate,
  calculateReceivedDate,
  calculateOverdueDays,
  calculateReceivedAmount,
  calculateLateFee,
  calculateRemainingAmount,
  calculateRenewAmount,
  calculateLoanPlan
} = require('./loan-calculator');

test('User Example Rule: 7-Day Loan Term means 02-Nov-2026 to 08-Nov-2026', () => {
  // Exact user example: Received 02-Nov-2026 -> Due 08-Nov-2026
  const due = calculateDueDate('02-Nov-2026');
  assert.strictEqual(due, '08-Nov-2026');

  // Reverse: Due 08-Nov-2026 -> Received 02-Nov-2026
  const received = calculateReceivedDate('08-Nov-2026');
  assert.strictEqual(received, '02-Nov-2026');

  // Also with numeric format 02-11-2026 -> 08-11-2026
  const dueNumeric = calculateDueDate('02-11-2026');
  assert.strictEqual(dueNumeric, '08-11-2026');

  const receivedNumeric = calculateReceivedDate('08-11-2026');
  assert.strictEqual(receivedNumeric, '02-11-2026');
});

test('Rule 2: Overdue days starts counting from the day after Due Date', () => {
  const due = '08-Nov-2026';

  // On due date (08-Nov-2026) -> 0 days overdue
  assert.strictEqual(calculateOverdueDays(due, '08-Nov-2026'), 0);

  // Before due date (07-Nov-2026) -> 0 days overdue
  assert.strictEqual(calculateOverdueDays(due, '07-Nov-2026'), 0);

  // 1 day after due date (09-Nov-2026) -> exactly 1 day overdue
  assert.strictEqual(calculateOverdueDays(due, '09-Nov-2026'), 1);

  // 2 days after due date (10-Nov-2026) -> exactly 2 days overdue
  assert.strictEqual(calculateOverdueDays(due, '10-Nov-2026'), 2);
});

test('Rule 3: Late fee is 7% per overdue day on unpaid principal', () => {
  const loan = 11000;
  const paid = 0;

  // 1 day overdue: 11000 * 7% = 770
  assert.strictEqual(calculateLateFee(loan, paid, 1), 770);

  // 2 days overdue: 770 * 2 = 1540
  assert.strictEqual(calculateLateFee(loan, paid, 2), 1540);

  // Partial paid: loan 10000, paid 2000, remaining base 8000. 1 day overdue: 8000 * 7% = 560
  assert.strictEqual(calculateLateFee(10000, 2000, 1), 560);
});

test('Rule 4: Received Amount is always 60% of Loan Amount (40% interest deducted)', () => {
  assert.strictEqual(calculateReceivedAmount(11000), 6600);
  assert.strictEqual(calculateReceivedAmount(20000), 12000);
  assert.strictEqual(calculateReceivedAmount(10000), 6000);
});

test('Rule 5: Remaining Amount formula: {(Loan Amount + Late Fee) - Amount Paid}', () => {
  // Loan 11000, Late Fee 1540 (2 days overdue), Paid 0 -> Remaining = 12540
  assert.strictEqual(calculateRemainingAmount(11000, 0, 1540), 12540);

  // Loan 20000, Late Fee 2100, Paid 5000 -> (20000 + 2100) - 5000 = 17100
  assert.strictEqual(calculateRemainingAmount(20000, 5000, 2100), 17100);
});

test('Rule 6: Renew Amount is 40% of Remaining Amount', () => {
  // For remaining 12540 -> 12540 * 0.40 = 5016
  assert.strictEqual(calculateRenewAmount(12540), 5016);
  // For remaining 17100 -> 17100 * 0.40 = 6840
  assert.strictEqual(calculateRenewAmount(17100), 6840);
});

test('calculateLoanPlan automatically sets 7-day term (02-Nov to 08-Nov)', () => {
  const plan = calculateLoanPlan({
    loanAmount: 11000,
    amountPaid: 0,
    amountReceivedDate: '02-Nov-2026',
    asOfDate: '10-Nov-2026' // 2 days after due date 08-Nov-2026
  });

  assert.strictEqual(plan.loanAmount, 11000);
  assert.strictEqual(plan.receivedAmount, 6600); // 60%
  assert.strictEqual(plan.amountReceivedDate, '02-Nov-2026');
  assert.strictEqual(plan.dueDate, '08-Nov-2026'); // Exact user example!
  assert.strictEqual(plan.overdueDays, 2); // 10-Nov vs 08-Nov = 2 days
  assert.strictEqual(plan.lateFee, 1540); // 7% * 2 days
  assert.strictEqual(plan.remainingAmount, 12540); // (11000 + 1540) - 0
  assert.strictEqual(plan.renewAmount, 5016); // 40% of 12540
});
