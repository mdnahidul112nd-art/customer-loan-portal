/**
 * Pure calculation logic for loan rules:
 * - 7-Day Loan Term (inclusive): e.g. 02-Nov-2026 to 08-Nov-2026 (+6 calendar days difference)
 * - Received Amount = 60% of Loan Amount (40% interest deducted upfront)
 * - Due Date = Amount Received Date + 6 days
 * - Amount Received Date = Due Date - 6 days
 * - Overdue Days: counts days elapsed after Due Date (starts 1 day after Due Date)
 * - Late Fee = 7% per overdue day based on unpaid principal {Loan Amount - Paid Amount}
 * - Remaining Amount = (Loan Amount + Late Fee) - Paid Amount
 * - Renew Amount = 40% of Remaining Amount
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Parses date in:
 * - DD-MMM-YYYY (e.g. 02-Nov-2026, 08-Nov-2026)
 * - DD-MM-YYYY or DD/MM/YYYY (e.g. 02-11-2026)
 * - YYYY-MM-DD (e.g. 2026-11-02)
 */
function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Check DD-MMM-YYYY (e.g. 02-Nov-2026 or 2-Nov-2026)
  const dMmmYMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})$/);
  if (dMmmYMatch) {
    const d = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].toLowerCase().substring(0, 3);
    const y = parseInt(dMmmYMatch[3], 10);
    const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === mStr);
    if (monthIndex >= 0) {
      const dt = new Date(y, monthIndex, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }

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
  const mNum = String(date.getMonth() + 1).padStart(2, '0');
  const mName = MONTH_NAMES[date.getMonth()];
  const y = date.getFullYear();

  if (format === 'DD-MMM-YYYY') {
    return `${d}-${mName}-${y}`;
  }
  if (format === 'YYYY-MM-DD') {
    return `${y}-${mNum}-${d}`;
  }
  return `${d}-${mNum}-${y}`;
}

/**
 * 7-Day Loan Term calculation:
 * As in the user example: "02-Nov-2026 to 08-Nov-2026"
 * 02-Nov (Day 1) + 6 days = 08-Nov (Day 7, Due Date)
 */
function calculateDueDate(receivedDateInput, preferFormat = null) {
  const dt = parseDate(receivedDateInput);
  if (!dt) return '';
  const res = new Date(dt.getTime());
  res.setDate(res.getDate() + 6); // 7-day term inclusive: day 1 to day 7 is +6 days

  const format = preferFormat || (hasMonthName(receivedDateInput) ? 'DD-MMM-YYYY' : 'DD-MM-YYYY');
  return formatDate(res, format);
}

function calculateReceivedDate(dueDateInput, preferFormat = null) {
  const dt = parseDate(dueDateInput);
  if (!dt) return '';
  const res = new Date(dt.getTime());
  res.setDate(res.getDate() - 6); // 7-day term inclusive: -6 days

  const format = preferFormat || (hasMonthName(dueDateInput) ? 'DD-MMM-YYYY' : 'DD-MM-YYYY');
  return formatDate(res, format);
}

function hasMonthName(str) {
  return /[A-Za-z]{3}/.test(String(str || ''));
}

function addDays(dateInput, days = 6, targetFormat = 'DD-MM-YYYY') {
  const dt = parseDate(dateInput);
  if (!dt) return '';
  const res = new Date(dt.getTime());
  res.setDate(res.getDate() + days);
  return formatDate(res, targetFormat);
}

/**
 * When Due Date is over, starts counting overdue days from the next day.
 * If asOfDate <= dueDate, overdue is 0.
 * E.g. Due 08-Nov-2026:
 * - On 08-Nov-2026 -> 0 days overdue
 * - On 09-Nov-2026 -> 1 day overdue
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

  // Date synchronization using exact 7-day term (e.g. 02-Nov-2026 to 08-Nov-2026)
  let receivedDate = params.amountReceivedDate || '';
  let dueDate = params.dueDate || '';

  if (receivedDate && !dueDate) {
    dueDate = calculateDueDate(receivedDate);
  } else if (dueDate && !receivedDate) {
    receivedDate = calculateReceivedDate(dueDate);
  } else if (!dueDate && !receivedDate) {
    const today = new Date();
    receivedDate = formatDate(today);
    dueDate = calculateDueDate(today);
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
  MONTH_NAMES,
  parseDate,
  formatDate,
  calculateDueDate,
  calculateReceivedDate,
  addDays,
  calculateOverdueDays,
  calculateReceivedAmount,
  calculateLateFee,
  calculateRemainingAmount,
  calculateRenewAmount,
  calculateLoanPlan
};
