const test = require('node:test');
const assert = require('node:assert');
const {
  parseDate,
  formatDate,
  addDays,
  calculateOverdueDays,
  calculateReceivedAmount,
  calculateLateFee,
  calculateRemainingAmount,
  calculateRenewAmount,
  calculateLoanPlan
} = require('./loan-calculator');

test('Rule 1: 7-day term date calculation (Amount Received Date to Due Date and vice versa)', () => {
  // 1st rule: If Amount Received Date is given, Due Date is exactly 7 days after
  const dueDate = addDays('23-10-2026', 7);
  assert.strictEqual(dueDate, '30-10-2026');

  // Summary: If Due Date is given, Amount Received Date is exactly 7 days before
  const receivedDate = addDays('30-10-2026', -7);
  assert.strictEqual(receivedDate, '23-10-2026');
});

test('Rule 2: Overdue days starts counting from the day after Due Date', () => {
  const due = '30-10-2026';

  // On due date -> 0 days overdue
  assert.strictEqual(calculateOverdueDays(due, '30-10-2026'), 0);

  // Before due date -> 0 days overdue
  assert.strictEqual(calculateOverdueDays(due, '28-10-2026'), 0);

  // 1 day after due date (31-10-2026) -> exactly 1 day overdue
  assert.strictEqual(calculateOverdueDays(due, '31-10-2026'), 1);

  // 2 days after due date (01-11-2026) -> exactly 2 days overdue
  assert.strictEqual(calculateOverdueDays(due, '01-11-2026'), 2);
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
  assert.strictEqual(calculateReceivedAmount(10000), 6000);
  assert.strictEqual(calculateReceivedAmount(5000), 3000);
});

test('Rule 5: Remaining Amount formula: {(Loan Amount + Late Fee) - Amount Paid}', () => {
  // Loan 11000, Late Fee 1540 (2 days overdue), Paid 0 -> Remaining = 12540
  assert.strictEqual(calculateRemainingAmount(11000, 0, 1540), 12540);

  // Loan 10000, Late Fee 700 (1 day overdue), Paid 3000 -> (10000 + 700) - 3000 = 7700
  assert.strictEqual(calculateRemainingAmount(10000, 3000, 700), 7700);
});

test('Rule 6: Renew Amount is 40% of Remaining Amount', () => {
  // For remaining 12540 -> 12540 * 0.40 = 5016
  assert.strictEqual(calculateRenewAmount(12540), 5016);
});

test('calculateLoanPlan automatically ties all options together with minimal inputs', () => {
  // Admin fills only Loan Amount and Due Date
  const plan = calculateLoanPlan({
    loanAmount: 11000,
    amountPaid: 0,
    dueDate: '30-10-2026',
    asOfDate: '01-11-2026' // 2 days after due date
  });

  assert.strictEqual(plan.loanAmount, 11000);
  assert.strictEqual(plan.receivedAmount, 6600); // 60%
  assert.strictEqual(plan.amountReceivedDate, '23-10-2026'); // 7 days before
  assert.strictEqual(plan.dueDate, '30-10-2026');
  assert.strictEqual(plan.overdueDays, 2);
  assert.strictEqual(plan.lateFee, 1540); // 7% * 2 days
  assert.strictEqual(plan.remainingAmount, 12540); // (11000 + 1540) - 0
  assert.strictEqual(plan.renewAmount, 5016); // 40% of 12540
});
