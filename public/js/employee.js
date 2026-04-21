const API_BASE = '';
let allLeaves = [];
let currentFilter = 'all';
let cancelLeaveId = null;
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'employee') {
  window.location.href = '/index.html';
}
document.getElementById('userName').textContent = user.name;
document.getElementById('empIdDisplay').value = user.employee_id;
document.getElementById('empNameDisplay').value = user.name;
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">⏳ Pending</span>',
    approved: '<span class="badge badge-approved">✅ Approved</span>',
    rejected: '<span class="badge badge-rejected">❌ Rejected</span>',
    cancelled: '<span class="badge badge-cancelled">🚫 Cancelled</span>',
  };
  return map[status] || status;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

const today = new Date().toISOString().split('T')[0];
document.getElementById('fromDate').value = today;
document.getElementById('toDate').value = today;
document.getElementById('fromDate').min = today;
document.getElementById('toDate').min = today;

document.getElementById('fromDate').addEventListener('change', function () {
  const toDate = document.getElementById('toDate');
  if (toDate.value < this.value) {
    toDate.value = this.value;
  }
  toDate.min = this.value;
});

async function fetchLeaves() {
  try {
    const res = await fetch(`${API_BASE}/api/leaves/my`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/index.html';
      return;
    }

    const data = await res.json();
    allLeaves = data.leaves || [];
    renderLeaves();
  } catch (err) {
    showToast('Failed to load leaves.', 'error');
  }
}
function renderLeaves() {
  const tbody = document.getElementById('leavesBody');
  let filtered = allLeaves;

  if (currentFilter !== 'all') {
    filtered = allLeaves.filter(l => l.status === currentFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h4>No ${currentFilter === 'all' ? '' : currentFilter} leave applications</h4>
            <p>${currentFilter === 'all' ? 'Apply for a leave above to get started' : 'No leaves with this status'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((leave, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="leave-type-tag">${leave.leave_type}</span></td>
      <td>${formatDate(leave.from_date)}</td>
      <td>${formatDate(leave.to_date)}</td>
      <td title="${leave.reason}">${leave.reason.length > 30 ? leave.reason.substring(0, 30) + '…' : leave.reason}</td>
      <td>${getStatusBadge(leave.status)}</td>
      <td><span class="date-display">${formatDateTime(leave.applied_on)}</span></td>
      <td>${leave.action_by_name || '—'}<br><span class="date-display">${leave.action_by || ''}</span></td>
      <td><span class="date-display">${formatDateTime(leave.action_on)}</span></td>
      <td>
        ${leave.status === 'pending'
          ? `<button class="btn btn-warning btn-sm" onclick="openCancelModal(${leave.id})">Cancel</button>`
          : '<span class="text-muted">—</span>'
        }
      </td>
    </tr>
  `).join('');
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderLeaves();
  });
});

document.getElementById('leaveForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const leaveType = document.getElementById('leaveType').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  const reason = document.getElementById('reason').value.trim();
  const btn = document.getElementById('submitLeaveBtn');

  if (!leaveType || !fromDate || !toDate || !reason) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  if (fromDate > toDate) {
    showToast('"From Date" cannot be after "To Date".', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Submitting...';

  try {
    const res = await fetch(`${API_BASE}/api/leaves`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to apply.');

    showToast(data.message, 'success');

    document.getElementById('leaveType').value = '';
    document.getElementById('fromDate').value = today;
    document.getElementById('toDate').value = today;
    document.getElementById('reason').value = '';

    await fetchLeaves();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Submit Leave Application';
  }
});
function openCancelModal(leaveId) {
  cancelLeaveId = leaveId;
  document.getElementById('cancelModal').classList.remove('hidden');
}

document.getElementById('cancelModalClose').addEventListener('click', () => {
  document.getElementById('cancelModal').classList.add('hidden');
  cancelLeaveId = null;
});

document.getElementById('cancelModalConfirm').addEventListener('click', async () => {
  if (!cancelLeaveId) return;

  const btn = document.getElementById('cancelModalConfirm');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Cancelling...';

  try {
    const res = await fetch(`${API_BASE}/api/leaves/${cancelLeaveId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to cancel.');

    showToast(data.message, 'success');
    document.getElementById('cancelModal').classList.add('hidden');
    cancelLeaveId = null;
    await fetchLeaves();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Yes, Cancel Leave';
  }
});
document.getElementById('cancelModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('cancelModal').classList.add('hidden');
    cancelLeaveId = null;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});
fetchLeaves();
