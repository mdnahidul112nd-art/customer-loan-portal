/**
 * Pure calculation logic for loan rules:
 * - 7-day loan term
 * - Received Amount = 60% of Loan Amount (40% interest deducted upfront)
 * - Due Date = Amount Received Date + 7 days (or Received Date = Due Date - 7 days)
 * - Overdue Days: counts days elapsed after Due Date (starts 1 day after Due Date)
 * - Late Fee = 7% per overdue day based on unpaid principal {Loan Amount - Paid Amount}
 * - Remaining Amount = (Loan Amount + Late Fee) - Paid Amount
 * - Renew Amount = 40% of Remaining Amount
 */

/**
 * Parses date in DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD
 */
function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Check YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  return null;
}

function formatDate(date, format = 'DD-MM-YYYY') {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();

  if (format === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  }
  return `${d}-${m}-${y}`;
}

function addDays(dateInput, days = 7, targetFormat = 'DD-MM-YYYY') {
  const dt = parseDate(dateInput);
  if (!dt) return '';
  const res = new Date(dt.getTime());
  res.setDate(res.getDate() + days);
  return formatDate(res, targetFormat);
}

/**
 * When Due Date is over, starts counting overdue days from the next day.
 * If asOfDate <= dueDate, overdue is 0.
 * E.g. Due 30-10-2026, as of 31-10-2026 is 1 day overdue.
 */
function calculateOverdueDays(dueDateInput, asOfDateInput = new Date()) {
  const due = parseDate(dueDateInput);
  const asOf = parseDate(asOfDateInput);
  if (!due || !asOf) return 0;

  const diffTime = asOf.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Received Amount is 60% of Loan Amount (40% deducted upfront)
 */
function calculateReceivedAmount(loanAmount) {
  const loan = Math.max(0, parseFloat(loanAmount) || 0);
  return Math.round(loan * 0.60);
}

/**
 * Late fee: 7% per overdue day based on unpaid principal (Loan Amount - Paid Amount)
 */
function calculateLateFee(loanAmount, amountPaid, overdueDays) {
  const loan = Math.max(0, parseFloat(loanAmount) || 0);
  const paid = Math.max(0, parseFloat(amountPaid) || 0);
  const days = Math.max(0, parseInt(overdueDays, 10) || 0);
  const unpaidPrincipal = Math.max(0, loan - paid);

  if (days <= 0 || unpaidPrincipal <= 0) return 0;
  return Math.round(unpaidPrincipal * 0.07 * days);
}

/**
 * Remaining Amount: {(Loan Amount + Late Fee) - Amount Paid}
 */
function calculateRemainingAmount(loanAmount, amountPaid, lateFee) {
  const loan = Math.max(0, parseFloat(loanAmount) || 0);
  const paid = Math.max(0, parseFloat(amountPaid) || 0);
  const fee = Math.max(0, parseFloat(lateFee) || 0);

  return Math.max(0, Math.round((loan + fee) - paid));
}

/**
 * Renew Amount: 40% of Remaining Amount
 */
function calculateRenewAmount(remainingAmount) {
  const rem = Math.max(0, parseFloat(remainingAmount) || 0);
  return Math.round(rem * 0.40);
}

/**
 * Comprehensive calculator helper
 */
function calculateLoanPlan(params = {}) {
  const loanAmount = Math.max(0, parseFloat(params.loanAmount) || 0);
  const amountPaid = Math.max(0, parseFloat(params.amountPaid) || 0);

  // Date synchronization
  let receivedDate = params.amountReceivedDate || '';
  let dueDate = params.dueDate || '';

  if (receivedDate && !dueDate) {
    dueDate = addDays(receivedDate, 7);
  } else if (dueDate && !receivedDate) {
    receivedDate = addDays(dueDate, -7);
  } else if (!dueDate && !receivedDate) {
    const today = new Date();
    receivedDate = formatDate(today);
    dueDate = addDays(today, 7);
  }

  // Overdue calculation
  let overdueDays = 0;
  if (params.overdueDays !== undefined && params.overdueDays !== null && params.overdueDays !== '') {
    overdueDays = Math.max(0, parseInt(params.overdueDays, 10) || 0);
  } else {
    overdueDays = calculateOverdueDays(dueDate, params.asOfDate || new Date());
  }

  const receivedAmount = calculateReceivedAmount(loanAmount);
  const lateFee = calculateLateFee(loanAmount, amountPaid, overdueDays);
  const remainingAmount = calculateRemainingAmount(loanAmount, amountPaid, lateFee);
  const renewAmount = calculateRenewAmount(remainingAmount);

  return {
    loanAmount,
    receivedAmount,
    amountPaid,
    amountReceivedDate: receivedDate,
    dueDate,
    overdueDays,
    lateFee,
    remainingAmount,
    renewAmount
  };
}

module.exports = {
  parseDate,
  formatDate,
  addDays,
  calculateOverdueDays,
  calculateReceivedAmount,
  calculateLateFee,
  calculateRemainingAmount,
  calculateRenewAmount,
  calculateLoanPlan
};
