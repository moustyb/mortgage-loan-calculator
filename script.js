// Utility formatters
const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const pad2 = (n) => String(n).padStart(2, '0');

// --- Payment formulas ---
function monthlyPayment(P, rAnnual, nYears) {
  const r = rAnnual / 100 / 12;   // monthly rate
  const n = nYears * 12;          // number of months
  if (r === 0) return P / n;
  return P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function biweeklyPayment(P, rAnnual, nYears) {
  const r = rAnnual / 100 / 26;   // biweekly rate
  const n = nYears * 26;
  if (r === 0) return P / n;
  return P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// --- Build amortization schedule ---
function buildSchedule({ amount, apr, termYears, extra, startMonth, compounding }) {
  const rows = [];
  let balance = amount;
  let totalInterest = 0, totalPayment = 0, totalPrincipal = 0, totalExtra = 0;

  const isMonthly = compounding === 'monthly';
  const basePayment = isMonthly
    ? monthlyPayment(amount, apr, termYears)
    : biweeklyPayment(amount, apr, termYears);

  const periodRate = apr / 100 / (isMonthly ? 12 : 26);
  let y = startMonth?.getUTCFullYear();
  let m = startMonth ? startMonth.getUTCMonth() : undefined;

  for (let i = 1; balance > 0 && i <= termYears * (isMonthly ? 12 : 26) + 1000; i++) {
    const interest = balance * periodRate;
    let principal = basePayment - interest;

    if (principal + extra > balance) {
      principal = balance; // final payment
    }

    const payment = principal + interest;
    balance = Math.max(0, balance - principal - extra);

    totalInterest += interest;
    totalPrincipal += principal;
    totalPayment += payment + extra;
    totalExtra += extra;

    // Date label
    let labelDate = '';
    if (typeof m === 'number') {
      if (isMonthly) {
        const mm = (m + (i - 1)) % 12;
        const yy = y + Math.floor((m + (i - 1)) / 12);
        labelDate = `${yy}-${pad2(mm + 1)}`;
      } else {
        const start = new Date(Date.UTC(y, m, 1));
        const date = new Date(start.getTime() + (i - 1) * 14 * 24 * 60 * 60 * 1000);
        labelDate = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
      }
    }

    rows.push({ period: i, date: labelDate, payment, interest, principal, extra, balance });

    if (balance <= 0.00001) break;
  }

  return {
    basePayment,
    rows,
    totals: { interest: totalInterest, payment: totalPayment, principal: totalPrincipal, extra: totalExtra }
  };
}

// --- Event handlers ---
function onCalc() {
  const amount = parseFloat(document.getElementById('loanAmount').value);
  const apr = parseFloat(document.getElementById('annualRate').value);
  const termYears = parseInt(document.getElementById('termYears').value, 10);
  const extra = parseFloat(document.getElementById('extraPayment').value || '0');
  const compounding = document.getElementById('compounding').value;
  const startDateInput = document.getElementById('startDate').value;
  const errorEl = document.getElementById('error');

  if (!amount || amount <= 0 || !apr || apr < 0 || !termYears || termYears <= 0) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Please enter valid positive values for amount, APR, and term.';
    return;
  }
  errorEl.style.display = 'none';

  const startMonth = startDateInput ? new Date(startDateInput + '-01T00:00:00Z') : null;

  const { basePayment, rows, totals } = buildSchedule({
    amount, apr, termYears, extra: extra || 0, startMonth, compounding
  });

  // Summary
  document.getElementById('monthlyPayment').textContent = fmt.format(basePayment);
  document.getElementById('totalInterest').textContent = fmt.format(totals.interest);
  document.getElementById('periodLabel').textContent = `Period: ${compounding === 'monthly' ? 'Monthly' : 'Biweekly'}`;

  // Payoff date
  let payoffDate = '—';
  if (rows.length && rows[rows.length - 1].date) {
    payoffDate = rows[rows.length - 1].date;
  } else {
    payoffDate = `After ${rows.length} periods`;
  }
  document.getElementById('payoffDate').textContent = payoffDate;

  // Table
  const tbody = document.querySelector('#amortTable tbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.period}</td>
      <td>${row.date || '—'}</td>
      <td>${fmt.format(row.payment)}</td>
      <td>${fmt.format(row.interest)}</td>
      <td>${fmt.format(row.principal)}</td>
      <td>${fmt.format(row.extra)}</td>
      <td>${fmt.format(row.balance)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Totals
  document.getElementById('totPayment').textContent = fmt.format(totals.payment);
  document.getElementById('totInterest').textContent = fmt.format(totals.interest);
  document.getElementById('totPrincipal').textContent = fmt.format(totals.principal);
  document.getElementById('totExtra').textContent = fmt.format(totals.extra);
}

function onReset() {
  ['loanAmount','annualRate','termYears','extraPayment','startDate'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('compounding').value = 'monthly';
  document.getElementById('error').style.display = 'none';
  document.getElementById('monthlyPayment').textContent = '—';
  document.getElementById('totalInterest').textContent = '—';
  document.getElementById('payoffDate').textContent = '—';
  document.getElementById('periodLabel').textContent = 'Period: Monthly';
  document.querySelector('#amortTable tbody').innerHTML = '';
  document.getElementById('totPayment').textContent = '$0';
  document.getElementById('totInterest').textContent = '$0';
  document.getElementById('totPrincipal').textContent = '$0';
  document.getElementById('totExtra').textContent = '$0';
}

// --- Wire up buttons ---
document.getElementById('calcBtn').addEventListener('click', onCalc);
document.getElementById('resetBtn').addEventListener('click', onReset);
