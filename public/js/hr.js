const API_BASE = '';
let allLeaves = [];
let currentFilter = 'pending';
let actionLeaveId = null;
let actionType = null;
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'hr') {
  window.location.href = '/index.html';
}
document.getElementById('userName').textContent = user.name;

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
document.getElementById('viewDate').value = today;
document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short'
});

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/hr/stats`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/index.html';
      return;
    }

    const data = await res.json();

    document.getElementById('todayOnLeave').textContent = data.today.on_leave;
    document.getElementById('pendingCount').textContent = data.today.pending;
  } catch (err) {
    showToast('Failed to load stats.', 'error');
  }
}
async function fetchLeavesByDate(date) {
  try {
    const res = await fetch(`${API_BASE}/api/hr/leaves/date/${date}`, {
      headers: authHeaders(),
    });

    const data = await res.json();
    const leaves = data.leaves || [];

    document.getElementById('selectedDateCount').textContent = data.count;

    const tbody = document.getElementById('dateLeavesBody');

    if (leaves.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-icon">🎉</div>
              <h4>No one on leave</h4>
              <p>No leave applications for ${formatDate(date)}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = leaves.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.employee_id}</td>
        <td>${l.employee_name}</td>
        <td><span class="leave-type-tag">${l.leave_type}</span></td>
        <td>${formatDate(l.from_date)}</td>
        <td>${formatDate(l.to_date)}</td>
        <td>${getStatusBadge(l.status)}</td>
        <td title="${l.reason}">${l.reason.length > 25 ? l.reason.substring(0, 25) + '…' : l.reason}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load date leaves.', 'error');
  }
}

async function fetchAllLeaves() {
  try {
    const res = await fetch(`${API_BASE}/api/hr/leaves`, {
      headers: authHeaders(),
    });

    const data = await res.json();
    allLeaves = data.leaves || [];
    renderAllLeaves();
  } catch (err) {
    showToast('Failed to load leave requests.', 'error');
  }
}

function renderAllLeaves() {
  const tbody = document.getElementById('allLeavesBody');
  let filtered = allLeaves;

  if (currentFilter !== 'all') {
    filtered = allLeaves.filter(l => l.status === currentFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h4>No ${currentFilter === 'all' ? '' : currentFilter} leave requests</h4>
            <p>No leave applications with this status</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.employee_id}</td>
      <td>${l.employee_name}</td>
      <td><span class="leave-type-tag">${l.leave_type}</span></td>
      <td>${formatDate(l.from_date)}</td>
      <td>${formatDate(l.to_date)}</td>
      <td title="${l.reason}">${l.reason.length > 20 ? l.reason.substring(0, 20) + '…' : l.reason}</td>
      <td><span class="date-display">${formatDateTime(l.applied_on)}</span></td>
      <td>${getStatusBadge(l.status)}</td>
      <td>${l.action_by_name ? l.action_by_name + '<br><span class="date-display">' + l.action_by + '</span>' : '—'}</td>
      <td><span class="date-display">${formatDateTime(l.action_on)}</span></td>
      <td>
        ${l.status === 'pending'
          ? `<div class="action-btns">
              <button class="btn btn-success btn-sm" onclick="openActionModal(${l.id}, 'approved')">✅ Approve</button>
              <button class="btn btn-danger btn-sm" onclick="openActionModal(${l.id}, 'rejected')">❌ Reject</button>
            </div>`
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
    renderAllLeaves();
  });
});

document.getElementById('viewDateBtn').addEventListener('click', () => {
  const date = document.getElementById('viewDate').value;
  if (date) fetchLeavesByDate(date);
});

document.getElementById('todayBtn').addEventListener('click', () => {
  document.getElementById('viewDate').value = today;
  fetchLeavesByDate(today);
});

document.getElementById('viewDate').addEventListener('change', function () {
  if (this.value) fetchLeavesByDate(this.value);
});
function openActionModal(leaveId, action) {
  actionLeaveId = leaveId;
  actionType = action;

  const title = document.getElementById('actionModalTitle');
  const text = document.getElementById('actionModalText');
  const confirmBtn = document.getElementById('actionModalConfirm');

  if (action === 'approved') {
    title.textContent = '✅ Approve Leave';
    text.textContent = 'Are you sure you want to approve this leave application?';
    confirmBtn.className = 'btn btn-success btn-sm';
    confirmBtn.textContent = 'Yes, Approve';
  } else {
    title.textContent = '❌ Reject Leave';
    text.textContent = 'Are you sure you want to reject this leave application?';
    confirmBtn.className = 'btn btn-danger btn-sm';
    confirmBtn.textContent = 'Yes, Reject';
  }

  document.getElementById('actionModal').classList.remove('hidden');
}

document.getElementById('actionModalClose').addEventListener('click', () => {
  document.getElementById('actionModal').classList.add('hidden');
  actionLeaveId = null;
  actionType = null;
});

document.getElementById('actionModalConfirm').addEventListener('click', async () => {
  if (!actionLeaveId || !actionType) return;

  const btn = document.getElementById('actionModalConfirm');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Processing...';

  try {
    const res = await fetch(`${API_BASE}/api/hr/leaves/${actionLeaveId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ action: actionType }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Action failed.');

    showToast(data.message, 'success');
    document.getElementById('actionModal').classList.add('hidden');
    actionLeaveId = null;
    actionType = null;

    // Refresh everything
    await Promise.all([fetchStats(), fetchAllLeaves(), fetchLeavesByDate(document.getElementById('viewDate').value)]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = actionType === 'approved' ? 'Yes, Approve' : 'Yes, Reject';
  }
});

document.getElementById('actionModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('actionModal').classList.add('hidden');
    actionLeaveId = null;
    actionType = null;
  }
});
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

fetchStats();
fetchAllLeaves();
fetchLeavesByDate(today);
