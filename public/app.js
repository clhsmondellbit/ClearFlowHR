/**
 * ClearFlowHR — Enterprise HRM Application Logic
 * Pure Vanilla JS, Clean Architecture, Zero Emojis, Modern Professional UX
 */

'use strict';

// ── Configuration & Endpoints ───────────────────────────────────────────────
const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://localhost:4647';

const STORAGE_KEYS = {
  MY_REQUESTS: 'clearflow_my_requests',
  REVIEWER_CASES: 'clearflow_reviewer_cases',
  LEDGER_HISTORY: 'aer_history_v1',
};

// ── Corporate SVG Icons ─────────────────────────────────────────────────────
const ICONS = {
  checkCircle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  clock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
};

// ── Reviewer Cases Data ─────────────────────────────────────────────────────
const INITIAL_REVIEWER_CASES = [
  {
    id: 'CASE-01',
    applicantName: 'Lê Thị Phương',
    applicantId: 'NV-1981-0592',
    department: 'Phòng Kế hoạch & Quản lý Sản xuất',
    leaveType: 'SICK',
    leaveTypeName: 'Nghỉ ốm / Chế độ BHXH',
    days: 10,
    startDate: '2026-10-15',
    endDate: '2026-10-24',
    reason: 'Điều trị ngoại trú tại nhà theo chỉ định bác sĩ BV Quận 1',
    status: 'PENDING',
    statusLabel: 'Chờ duyệt',
    decisionId: 'case-01-uuid-eval-001',
    docName: 'Giấy chứng nhận C65-HD (Có mộc đỏ BV Q1)',
    docUrl: '/cases/case_01_le_thi_phuong/bang_chung_le_thi_phuong.jpg',
    pdfUrl: '/cases/case_01_le_thi_phuong/don_nghi_om_le_thi_phuong.pdf',
    note: 'Đơn có đính kèm đầy đủ mẫu C65-HD có mộc đỏ và chữ ký bác sĩ chỉ định.',
  },
  {
    id: 'CASE-02',
    applicantName: 'Trương Minh Trí',
    applicantId: 'NV-2020-0019',
    department: 'Phòng Công Nghệ',
    leaveType: 'SICK',
    leaveTypeName: 'Nghỉ ốm / Chế độ BHXH',
    days: 6,
    startDate: '2026-10-20',
    endDate: '2026-10-25',
    reason: 'Nhiễm sốt siêu vi, tự cách ly tại nhà',
    status: 'PENDING',
    statusLabel: 'Thiếu chứng từ y tế',
    decisionId: 'case-02-uuid-eval-002',
    docName: 'Chưa có chứng từ y tế',
    docUrl: null,
    pdfUrl: '/cases/case_02_truong_minh_tri/don_nghi_om_truong_minh_tri.pdf',
    note: 'Chưa nộp giấy C65-HD hoặc giấy ra viện. Cần yêu cầu bổ sung minh chứng.',
  },
  {
    id: 'CASE-03',
    applicantName: 'Hoàng Văn Bình',
    applicantId: 'NV-2021-0034',
    department: 'Phòng Logistics',
    leaveType: 'UNPAID',
    leaveTypeName: 'Nghỉ không hưởng lương',
    days: 20,
    startDate: '2026-11-01',
    endDate: '2026-11-20',
    reason: 'Giải quyết việc riêng gia đình dài ngày',
    status: 'PENDING',
    statusLabel: 'Vượt thẩm quyền (>5 ngày)',
    decisionId: 'case-03-uuid-eval-003',
    docName: 'Đơn xin nghỉ việc riêng BM-HR-01',
    docUrl: null,
    pdfUrl: '/cases/case_03_hoang_van_binh/don_nghi_khong_luong_hoang_van_binh.pdf',
    note: 'Nghỉ không lương 20 ngày cần phân cấp Giám đốc Khối hoặc Ban Giám Đốc phê duyệt.',
  },
  {
    id: 'CASE-04',
    applicantName: 'Nguyễn Thị Hương',
    applicantId: 'NV-2024-0312',
    department: 'Phòng Kinh doanh',
    leaveType: 'ANNUAL',
    leaveTypeName: 'Nghỉ phép năm',
    days: 1,
    startDate: '2026-10-18',
    endDate: '2026-10-18',
    reason: 'Giải quyết việc cá nhân gia đình',
    status: 'APPROVED',
    statusLabel: 'Đã tự động duyệt',
    decisionId: 'case-04-uuid-eval-004',
    docName: 'Đơn phép năm BM-HR-01',
    docUrl: null,
    pdfUrl: '/cases/case_04_nguyen_thi_huong/don_phep_nam_nguyen_thi_huong.pdf',
    note: 'Hồ sơ đạt tiêu chuẩn Điều 10.1, hệ thống đã tự động phê duyệt tức thì.',
  },
];

// ── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let accountDirectory = [];
let attachedFiles = [];
let currentSelectedCaseId = null;
let impactQuerySequence = 0;

// ── Crypto Helpers ──────────────────────────────────────────────────────────
async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Toast Notification ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  const icon = type === 'success' ? ICONS.checkCircle : type === 'error' ? ICONS.alertTriangle : ICONS.info;
  toast.innerHTML = `<span style="display:flex; align-items:center">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// ── Date & Days Calculator ──────────────────────────────────────────────────
function calculateWorkingDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (end < start) return 1;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    // Exclude Saturday (6) and Sunday (0)
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

function updateDaysRequested() {
  const start = document.getElementById('input-start-date').value;
  const end = document.getElementById('input-end-date').value;
  const days = calculateWorkingDays(start, end);
  document.getElementById('input-days').value = days;
  document.getElementById('days-summary-text').textContent = `${days} ngày làm việc (không tính T7 & CN)`;
  renderImpactAssessment();
}

async function renderImpactAssessment() {
  const countElement = document.getElementById('impact-dept-count');
  if (!countElement) return;

  const startDate = document.getElementById('input-start-date')?.value;
  const endDate = document.getElementById('input-end-date')?.value;
  const roleElement = document.getElementById('impact-requester-role');
  const departmentSummary = document.getElementById('impact-dept-summary');
  const roleSummary = document.getElementById('impact-role-summary');

  if (!currentUser) {
    countElement.textContent = '—';
    roleElement.textContent = '—';
    departmentSummary.textContent = 'Đăng nhập để xem đơn cùng phòng ban.';
    roleSummary.textContent = 'Vai trò sẽ hiển thị sau khi đăng nhập.';
    return;
  }

  const roleLabels = {
    EMPLOYEE: 'Nhân viên',
    MANAGER: 'Trưởng phòng',
    DIRECTOR: 'Giám đốc',
  };
  roleElement.textContent = roleLabels[currentUser.role] || currentUser.roleTitle;
  roleSummary.textContent = currentUser.role === 'DIRECTOR'
    ? 'Cần chọn người quản lý được ủy quyền trước khi gửi đơn.'
    : currentUser.role === 'MANAGER'
      ? 'Đơn của quản lý sẽ được chuyển đến cấp có thẩm quyền.'
      : 'Đơn được xem xét cùng mức độ ảnh hưởng trong phòng ban.';

  if (!startDate || !endDate) {
    countElement.textContent = '—';
    departmentSummary.textContent = 'Chọn khoảng ngày nghỉ để xem đánh giá.';
    return;
  }

  const querySequence = ++impactQuerySequence;
  const employeeId = currentUser.employeeId;
  countElement.textContent = '…';
  departmentSummary.textContent = 'Đang cập nhật đơn cùng phòng ban.';

  try {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const response = await fetch(`${API_BASE}/api/v1/impact?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Impact request failed');
    const result = await response.json();
    if (querySequence !== impactQuerySequence || currentUser?.employeeId !== employeeId) return;

    countElement.textContent = `${result.request_count} đơn`;
    departmentSummary.textContent = result.request_count
      ? `${result.request_count} đơn khác trong ${result.department} trùng thời gian.`
      : `Chưa có đơn khác trong ${result.department} trùng thời gian.`;
  } catch {
    if (querySequence !== impactQuerySequence || currentUser?.employeeId !== employeeId) return;
    countElement.textContent = '—';
    departmentSummary.textContent = 'Chưa lấy được số liệu tác động từ máy chủ.';
  }
}

// ── Tab Navigation ──────────────────────────────────────────────────────────
function switchTab(tabId) {
  const managerTabs = ['reviewer'];
  const directorTabs = ['ledger', 'smoke', 'vlm'];
  if (managerTabs.includes(tabId) && !['MANAGER', 'DIRECTOR'].includes(currentUser?.role)) return;
  if (directorTabs.includes(tabId) && currentUser?.role !== 'DIRECTOR') return;

  document.querySelectorAll('.tab-pane').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((el) => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`nav-btn-${tabId}`);
  if (targetTab) targetTab.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  const titles = {
    apply: { breadcrumb: 'Đơn xin nghỉ', title: 'Đơn Xin Nghỉ Phép Trực Tuyến' },
    requests: { breadcrumb: 'Lịch sử yêu cầu', title: 'Lịch Sử & Tiến Trình Phê Duyệt' },
    policy: { breadcrumb: 'Văn bản quy định', title: 'Quy Chế & Biểu Mẫu Nghỉ Phép Doanh Nghiệp' },
    reviewer: { breadcrumb: 'Cổng quản trị', title: 'Xét Duyệt Hồ Sơ Nghỉ Phép (Reviewer Portal)' },
    ledger: { breadcrumb: 'Kiểm toán hệ thống', title: 'Sổ Cái Giao Dịch Kiểm Toán Bất Biến (Audit Ledger)' },
    smoke: { breadcrumb: 'Kiểm thử động cơ', title: 'Bộ Kiểm Thử Chuẩn Định Hướng (5 Canonical Benchmark Cases)' },
    vlm: { breadcrumb: 'Thẩm định thị giác', title: 'Kiểm Định Thị Giác Tài Liệu & Mộc Đỏ (VLM OCR)' },
  };

  const meta = titles[tabId] || titles.apply;
  document.getElementById('breadcrumb-current').textContent = meta.breadcrumb;
  document.getElementById('page-main-title').textContent = meta.title;

  if (tabId === 'requests') {
    renderMyRequests();
  } else if (tabId === 'reviewer') {
    renderReviewerCases();
  } else if (tabId === 'ledger') {
    renderLedger();
  } else if (tabId === 'smoke') {
    renderSmokeSuite();
  }
}

// ── Authenticated User Profile & Balance Rendering ──────────────────────────
function applyUserProfile(profile) {
  currentUser = { ...profile, id: profile.employeeId };
  document.getElementById('nav-user-name').textContent = currentUser.name;
  document.getElementById('nav-user-role').textContent = currentUser.roleTitle;
  document.getElementById('nav-user-avatar').textContent = currentUser.avatar;

  const bal = currentUser.balance;
  document.getElementById('balance-account-name').textContent = `Tài khoản: ${currentUser.name} · ${currentUser.employeeId}`;
  document.getElementById('bal-annual-remaining').textContent = `${bal.annual}.0`;
  document.getElementById('bal-annual-total').textContent = `/ ${bal.annualTotal} ngày`;
  const annualPct = bal.annualTotal > 0 ? Math.min(100, Math.round((bal.annual / bal.annualTotal) * 100)) : 0;
  document.getElementById('bal-annual-bar').style.width = `${annualPct}%`;

  document.getElementById('bal-sick-remaining').textContent = bal.sick;
  document.getElementById('bal-sick-bar').style.width = `${Math.min(100, Math.round((bal.sick / 30) * 100))}%`;
  document.getElementById('bal-maternity-remaining').textContent = bal.maternity;
  document.getElementById('bal-unpaid-used').textContent = bal.unpaid;

  const isManager = currentUser.role === 'MANAGER' || currentUser.role === 'DIRECTOR';
  const isDirector = currentUser.role === 'DIRECTOR';
  document.getElementById('nav-btn-reviewer').style.display = isManager ? 'inline-flex' : 'none';
  ['ledger', 'smoke', 'vlm'].forEach((tabKey) => {
    document.getElementById(`nav-btn-${tabKey}`).style.display = isDirector ? 'inline-flex' : 'none';
  });

  const nameField = document.getElementById('input-employee-name');
  if (nameField) nameField.value = `${currentUser.name} (${currentUser.employeeId} · ${currentUser.department})`;

  const delegationField = document.getElementById('impact-delegation-field');
  const delegationSelect = document.getElementById('impact-delegate');
  delegationField.hidden = !isDirector;
  delegationSelect.required = isDirector;
  delegationSelect.replaceChildren(new Option('Chọn quản lý nhận ủy quyền', ''));
  accountDirectory
    .filter((account) => account.role === 'MANAGER' && account.employeeId !== currentUser.employeeId)
    .forEach((account) => {
      const option = new Option(`${account.name} · ${account.roleTitle}`, account.employeeId);
      delegationSelect.append(option);
    });

  if (isDirector && !delegationSelect.options.length) {
    delegationSelect.append(new Option('Không có quản lý đủ thẩm quyền', ''));
  }

  updateRequestsBadge();
  renderImpactAssessment();
}

function setLoginVisible(visible) {
  const loginScreen = document.getElementById('login-screen');
  loginScreen.classList.toggle('is-hidden', !visible);
  if (visible) document.getElementById('login-username').focus();
}

function applyAuthenticatedSession(session) {
  accountDirectory = session.directory || [];
  applyUserProfile(session.user);
  setLoginVisible(false);
  switchTab('apply');
}

async function restoreSession() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/me`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No active session');
    applyAuthenticatedSession(await response.json());
  } catch {
    currentUser = null;
    setLoginVisible(true);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const submitButton = document.getElementById('login-submit');
  const errorElement = document.getElementById('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  submitButton.disabled = true;
  submitButton.textContent = 'Đang xác thực...';
  errorElement.textContent = '';

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json();
    if (!response.ok) {
      errorElement.textContent = response.status === 429
        ? 'Đăng nhập tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau.'
        : response.status === 401
          ? 'Tên tài khoản hoặc mật khẩu không chính xác.'
          : 'Không thể xác thực tài khoản. Vui lòng thử lại.';
      return;
    }

    document.getElementById('login-form').reset();
    applyAuthenticatedSession(result);
    showToast(`Đăng nhập thành công: ${currentUser.name}`, 'success');
  } catch {
    errorElement.textContent = 'Không kết nối được máy chủ. Vui lòng thử lại.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Đăng nhập';
  }
}

async function logout() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST' });
    if (!response.ok) throw new Error('Logout failed');
    currentUser = null;
    accountDirectory = [];
    document.getElementById('login-error').textContent = '';
    setLoginVisible(true);
  } catch {
    showToast('Không thể đăng xuất khỏi máy chủ. Vui lòng thử lại.', 'error');
  }
}

// ── Presets ─────────────────────────────────────────────────────────────────
function applyPreset(presetKey) {
  const today = new Date();
  const formatD = (d) => d.toISOString().split('T')[0];

  const presets = {
    annual_valid: {
      leaveType: 'ANNUAL',
      days: 1,
      startOffset: 2,
      reason: 'Giải quyết công việc gia đình cá nhân',
      files: [],
    },
    sick_with_c65: {
      leaveType: 'SICK',
      days: 3,
      startOffset: 0,
      reason: 'Sốt cao, khám tại Bệnh viện Quận và có chỉ định nghỉ dưỡng bệnh',
      sampleFile: {
        name: 'giay_chung_nhan_c65_hd.jpg',
        url: '/cases/case_01_le_thi_phuong/bang_chung_le_thi_phuong.jpg',
      },
    },
    unpaid_long: {
      leaveType: 'UNPAID',
      days: 10,
      startOffset: 5,
      reason: 'Thu xếp việc gia đình ở quê dài ngày',
      files: [],
    },
    probation_annual: {
      leaveType: 'ANNUAL',
      days: 2,
      startOffset: 1,
      reason: 'Nghỉ phép năm khi đang trong thời gian thử việc',
      files: [],
    },
  };

  const p = presets[presetKey];
  if (!p) return;

  const radio = document.querySelector(`input[name="leave_type"][value="${p.leaveType}"]`);
  if (radio) radio.checked = true;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() + p.startOffset);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (p.days - 1));

  document.getElementById('input-start-date').value = formatD(startDate);
  document.getElementById('input-end-date').value = formatD(endDate);
  document.getElementById('input-reason').value = p.reason;
  updateDaysRequested();

  attachedFiles = [];
  if (p.sampleFile) {
    loadPresetSampleFile(p.sampleFile.name, p.sampleFile.url);
  } else {
    renderFilePreview();
  }

  showToast(`Đã nạp kịch bản mẫu: ${p.reason}`, 'info');
}

async function loadPresetSampleFile(fileName, fileUrl) {
  try {
    const res = await fetch(fileUrl);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = () => {
      attachedFiles = [
        {
          name: fileName,
          base64: reader.result,
          mimeType: blob.type || 'image/jpeg',
          size: blob.size,
        },
      ];
      renderFilePreview();
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.warn('Could not load preset sample file', err);
  }
}

// ── File Upload & Drag & Drop ───────────────────────────────────────────────
function initFileUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
    }
  });
}

function handleFiles(fileList) {
  Array.from(fileList).forEach((file) => {
    if (file.size > 15 * 1024 * 1024) {
      showToast(`Tệp ${file.name} vượt quá dung lượng cho phép (15MB)`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      attachedFiles.push({
        name: file.name,
        base64: reader.result,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
      });
      renderFilePreview();
    };
    reader.readAsDataURL(file);
  });
}

function removeFile(index) {
  attachedFiles.splice(index, 1);
  renderFilePreview();
}

function renderFilePreview() {
  const container = document.getElementById('file-preview-list');
  if (!attachedFiles.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = attachedFiles
    .map((f, i) => {
      const isImg = f.mimeType.startsWith('image/');
      const icon = isImg ? `<img src="${f.base64}" class="attachment-thumb" alt="thumb" />` : ICONS.fileText;
      const sizeKb = Math.round(f.size / 1024);
      return `
      <div class="attachment-row">
        <div class="attachment-left">
          <div style="display:flex; align-items:center; color:var(--neutral-500)">${icon}</div>
          <div>
            <div class="attachment-name">${f.name}</div>
            <div style="font-size:11px; color:var(--neutral-500)">${sizeKb} KB · Đã tải lên</div>
          </div>
        </div>
        <button type="button" class="btn-remove-file" onclick="removeFile(${i})" title="Xóa tệp tin">${ICONS.x}</button>
      </div>
    `;
    })
    .join('');
}

// ── Submit Leave Request ────────────────────────────────────────────────────
async function handleLeaveSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    setLoginVisible(true);
    return;
  }

  const delegatedToId = document.getElementById('impact-delegate').value;
  if (currentUser.role === 'DIRECTOR' && !delegatedToId) {
    showToast('Giám đốc cần chọn người được ủy quyền trước khi gửi đơn.', 'error');
    document.getElementById('impact-delegate').focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-leave');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `Đang gửi thẩm định tự động...`;

  try {
    const leaveType = document.querySelector('input[name="leave_type"]:checked')?.value || 'ANNUAL';
    const startDate = document.getElementById('input-start-date').value;
    const endDate = document.getElementById('input-end-date').value;
    const daysRequested = parseInt(document.getElementById('input-days').value, 10) || 1;
    const reason = document.getElementById('input-reason').value;
    const delegate = accountDirectory.find((account) => account.employeeId === delegatedToId);

    const employeeHashedId = await sha256Hex(currentUser.id);
    const requestId = crypto.randomUUID();

    const attached_documents = attachedFiles.map((f) => ({
      document_id: crypto.randomUUID(),
      form_type: leaveType === 'SICK' ? 'C65-HD' : 'LEAVE_PROOF',
      content_ref: f.base64,
      mime_type: f.mimeType.includes('pdf') ? 'application/pdf' : 'image/jpeg',
    }));

    const payload = {
      request_id: requestId,
      employee_id: employeeHashedId,
      employee_name: currentUser.name,
      employment_status: currentUser.status,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_requested: daysRequested,
      leave_balance: {
        annual_days_remaining: currentUser.balance.annual,
        sick_days_remaining: currentUser.balance.sick,
        maternity_weeks_remaining: currentUser.balance.maternity,
        unpaid_days_used_ytd: currentUser.balance.unpaid,
      },
      delegated_to: delegate?.employeeId,
      attached_documents,
      submitted_at: new Date().toISOString(),
    };

    const res = await fetch(`${API_BASE}/api/v1/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    displayEvaluationResult(result, payload);

    saveUserRequest({
      id: `REQ-${Date.now().toString().slice(-4)}`,
      requestId,
      leaveType,
      days: daysRequested,
      startDate,
      endDate,
      reason,
      employeeId: currentUser.employeeId,
      department: currentUser.department,
      requesterRole: currentUser.role,
      delegatedToId: delegate?.employeeId || '',
      delegatedToName: delegate?.name || '',
      status: result.outcome,
      decisionReceipt: result.cryptographic_receipt,
      policyBasis: result.policy_basis,
      submittedAt: new Date().toISOString(),
    });

    addHistoryRecord({
      id: result.decision_id || crypto.randomUUID(),
      decision_id: result.decision_id || crypto.randomUUID(),
      request_id: requestId,
      time: result.evaluated_at || new Date().toISOString(),
      employee_name: currentUser.name,
      leave_type: leaveType,
      days: daysRequested,
      outcome: result.outcome,
      uncertainty_category: result.uncertainty_category || 'NONE',
      policy_basis: result.policy_basis || '',
      escalation_question: result.escalation_question || '',
      cryptographic_receipt: result.cryptographic_receipt || '',
      manager_action: null,
    });

    if (result.outcome === 'AUTO_APPROVE' && leaveType === 'ANNUAL') {
      currentUser.balance.annual = Math.max(0, currentUser.balance.annual - daysRequested);
      applyUserProfile(currentUser);
    }

    showToast('Đã nhận quyết định thẩm định hồ sơ thành công', 'success');
  } catch (err) {
    console.error('Submit error', err);
    showToast('Lỗi kết nối máy chủ phân xử. Vui lòng thử lại.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// ── Display Professional Result ─────────────────────────────────────────────
function displayEvaluationResult(result, payload) {
  const container = document.getElementById('result-container');
  if (!container) return;

  const outcome = result.outcome;
  let boxClass = 'approved';
  let icon = ICONS.checkCircle;
  let title = 'Yêu Cầu Nghỉ Phép Đã Được Phê Duyệt Tự Động';
  let desc = `Hồ sơ đạt tiêu chuẩn quy chế nhân sự. Đơn xin nghỉ ${payload.days_requested} ngày làm việc đã được hệ thống phê duyệt hợp lệ.`;

  if (outcome === 'ESCALATE') {
    boxClass = 'escalated';
    icon = ICONS.clock;
    title = 'Yêu Cầu Cần Phê Duyệt Cấp Quản Lý (In Review)';
    desc = result.escalation_question ||
      'Đơn nghỉ phép cần sự chấp thuận từ Quản lý trực tiếp hoặc Trưởng bộ phận theo phân cấp thẩm quyền (thời gian nghỉ trên 5 ngày hoặc đối soát minh chứng).';
  } else if (outcome === 'REJECT') {
    boxClass = 'rejected';
    icon = ICONS.alertTriangle;
    title = 'Yêu Cầu Chưa Đủ Điều Kiện Phê Duyệt';
    desc = 'Hồ sơ không đáp ứng điều kiện theo quy chế hiện hành (số dư phép năm không đủ hoặc loại hợp đồng lao động chưa được áp dụng).';
  }

  container.innerHTML = `
    <div class="evaluation-box ${boxClass}">
      <div class="eval-header">
        <div class="eval-icon-circle">${icon}</div>
        <div>
          <div class="eval-title">${title}</div>
          <div class="eval-message">${desc}</div>
        </div>
      </div>

      <div class="eval-meta-grid">
        <div class="eval-meta-row">
          <span class="eval-meta-key">Chế độ nghỉ</span>
          <span class="eval-meta-val">${payload.leave_type}</span>
        </div>
        <div class="eval-meta-row">
          <span class="eval-meta-key">Thời gian áp dụng</span>
          <span class="eval-meta-val">${payload.start_date} – ${payload.end_date} (${payload.days_requested} ngày làm việc)</span>
        </div>
        <div class="eval-meta-row">
          <span class="eval-meta-key">Căn cứ quy chế</span>
          <span class="eval-meta-val">${result.policy_basis || 'Quy chế Quản lý Nhân sự Doanh nghiệp'}</span>
        </div>
      </div>

      <button type="button" class="audit-collapse-btn" onclick="toggleReceipt()">
        ${ICONS.lock} Thông tin kiểm toán & Mã bảo chứng điện tử (Audit Trail)
      </button>
      <div id="receipt-drawer" class="audit-code-box">
        <strong>SHA-256 Receipt:</strong> ${result.cryptographic_receipt}<br>
        <strong>Decision ID:</strong> ${result.decision_id}<br>
        <strong>Evaluated At:</strong> ${result.evaluated_at}
      </div>
    </div>
  `;
}

function toggleReceipt() {
  const drawer = document.getElementById('receipt-drawer');
  if (drawer) {
    drawer.style.display = drawer.style.display === 'block' ? 'none' : 'block';
  }
}

// ── My Requests Management ──────────────────────────────────────────────────
function getSavedRequests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MY_REQUESTS)) || [];
  } catch {
    return [];
  }
}

function saveUserRequest(req) {
  const list = getSavedRequests();
  list.unshift(req);
  localStorage.setItem(STORAGE_KEYS.MY_REQUESTS, JSON.stringify(list));
  updateRequestsBadge();
  renderImpactAssessment();
}

function getCurrentUserRequests() {
  if (!currentUser) return [];
  return getSavedRequests().filter((item) => item.employeeId === currentUser.employeeId);
}

function updateRequestsBadge() {
  const list = getCurrentUserRequests();
  const badge = document.getElementById('badge-my-requests-count');
  if (badge) badge.textContent = list.length;
}

function renderMyRequests() {
  const tbody = document.getElementById('my-requests-tbody');
  if (!tbody) return;

  const list = getCurrentUserRequests();
  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--neutral-500)">
          Không có hồ sơ nào được ghi nhận. Vui lòng gửi yêu cầu mới tại mục "Nộp đơn nghỉ phép".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      let badgeClass = 'approved';
      let statusText = 'Đã phê duyệt';
      if (item.status === 'ESCALATE') {
        badgeClass = 'pending';
        statusText = 'Chờ quản lý duyệt';
      } else if (item.status === 'REJECT') {
        badgeClass = 'rejected';
        statusText = 'Từ chối';
      }

      return `
      <tr>
        <td><strong>${item.id}</strong></td>
        <td>${item.leaveType}</td>
        <td>${item.startDate} – ${item.endDate}</td>
        <td><strong>${item.days} ngày</strong></td>
        <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
        <td style="font-size:12px; color:var(--neutral-500)">${new Date(item.submittedAt).toLocaleDateString('vi-VN')}</td>
      </tr>
    `;
    })
    .join('');
}

// ── Reviewer Portal Logic ───────────────────────────────────────────────────
function getReviewerCases() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.REVIEWER_CASES);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_REVIEWER_CASES;
}

function saveReviewerCases(cases) {
  localStorage.setItem(STORAGE_KEYS.REVIEWER_CASES, JSON.stringify(cases));
}

function renderReviewerCases() {
  const listContainer = document.getElementById('reviewer-case-list');
  if (!listContainer) return;

  const cases = getReviewerCases();
  listContainer.innerHTML = cases
    .map((c) => {
      const activeClass = c.id === currentSelectedCaseId ? 'selected' : '';
      let badgeClass = 'approved';
      if (c.status === 'PENDING') badgeClass = 'pending';
      if (c.status === 'REJECTED') badgeClass = 'rejected';

      return `
      <div class="reviewer-queue-card ${activeClass}" onclick="selectReviewerCase('${c.id}')">
        <div class="queue-title">
          <span>${c.applicantName}</span>
          <span class="status-badge ${badgeClass}">${c.statusLabel}</span>
        </div>
        <div class="queue-sub">${c.applicantId} · ${c.department}</div>
        <div class="queue-meta">
          <span>${c.leaveTypeName} (${c.days} ngày)</span>
        </div>
      </div>
    `;
    })
    .join('');

  if (!currentSelectedCaseId && cases.length > 0) {
    selectReviewerCase(cases[0].id);
  } else if (currentSelectedCaseId) {
    renderCaseDetail(currentSelectedCaseId);
  }
}

function selectReviewerCase(caseId) {
  currentSelectedCaseId = caseId;
  document.querySelectorAll('.reviewer-queue-card').forEach((el) => el.classList.remove('selected'));
  renderReviewerCases();
  renderCaseDetail(caseId);
}

function renderCaseDetail(caseId) {
  const detailPanel = document.getElementById('reviewer-case-detail');
  if (!detailPanel) return;

  const cases = getReviewerCases();
  const c = cases.find((item) => item.id === caseId);
  if (!c) return;

  const docImgHtml = c.docUrl
    ? `
      <div style="background:var(--neutral-100); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; margin-top:12px">
        <div style="font-size:12px; font-weight:600; margin-bottom:8px">Minh chứng đính kèm (Mẫu C65-HD / Giấy viện):</div>
        <img src="${c.docUrl}" alt="Chứng từ y tế" onclick="openImageModal('${c.docUrl}')" style="max-height:220px; width:100%; object-fit:contain; background:#ffffff; border-radius:4px; cursor:zoom-in" title="Nhấp để phóng to" />
        <a href="${c.docUrl}" target="_blank" style="display:inline-block; font-size:12px; color:var(--primary); margin-top:8px">Mở ảnh gốc trong tab mới</a>
      </div>
    `
    : `
      <div style="background:var(--neutral-100); border:1px solid var(--border); border-radius:var(--radius-md); padding:24px; text-align:center; color:var(--neutral-500); margin-top:12px">
        <div style="font-size:13px; font-weight:600">Không có chứng từ hình ảnh đính kèm</div>
        <div style="font-size:11.5px; margin-top:2px">Nhân sự chưa tải lên giấy tờ minh chứng.</div>
      </div>
    `;

  const pdfHtml = c.pdfUrl
    ? `
      <div style="background:var(--neutral-100); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; margin-top:12px">
        <div style="font-size:12px; font-weight:600; margin-bottom:8px">Tệp đơn xin nghỉ (PDF BM-HR-01):</div>
        <div style="background:#ffffff; border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; display:flex; justify-content:space-between; align-items:center">
          <div style="display:flex; align-items:center; gap:8px">
            ${ICONS.fileText}
            <span style="font-size:12.5px; font-weight:500">${c.pdfUrl.split('/').pop()}</span>
          </div>
          <a href="${c.pdfUrl}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">Xem tệp PDF</a>
        </div>
      </div>
    `
    : '';

  detailPanel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:14px">
      <div>
        <h3 style="font-size:17px; font-weight:700; color:var(--neutral-900)">${c.applicantName} (${c.applicantId})</h3>
        <p style="font-size:12.5px; color:var(--neutral-500); margin-top:2px">${c.department} · Đơn nghỉ: <strong>${c.leaveTypeName}</strong></p>
      </div>
      <div>
        <span class="status-badge ${c.status === 'APPROVED' ? 'approved' : c.status === 'REJECTED' ? 'rejected' : 'pending'}">${c.statusLabel}</span>
      </div>
    </div>

    <div style="background:var(--neutral-50); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; font-size:12.5px; line-height:1.6">
      <div><strong>Khoảng thời gian:</strong> ${c.startDate} – ${c.endDate} (<strong>${c.days} ngày làm việc</strong>)</div>
      <div style="margin-top:4px"><strong>Lý do trình bày:</strong> ${c.reason}</div>
      <div style="margin-top:4px; color:var(--neutral-500)"><strong>Nhận định hệ thống:</strong> ${c.note}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px">
      ${pdfHtml}
      ${docImgHtml}
    </div>

    <div style="border-top:1px solid var(--border); padding-top:16px; margin-top:20px; display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap">
      <div>
        <button type="button" class="btn btn-outline btn-sm" id="btn-rejudge-${c.id}" onclick="runReviewerRejudge('${c.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Thẩm Định Lại (Rejudge)
        </button>
      </div>
      <div style="display:flex; gap:10px">
        <button type="button" class="btn btn-danger btn-sm" onclick="resolveReviewerCase('${c.id}', 'REJECT')">
          Từ Chối Đơn
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="resolveReviewerCase('${c.id}', 'SWITCH_TO_UNPAID')">
          Chuyển Nghỉ Không Lương
        </button>
        <button type="button" class="btn btn-success btn-sm" onclick="resolveReviewerCase('${c.id}', 'APPROVE')">
          Phê Duyệt Đơn
        </button>
      </div>
    </div>
  `;
}

async function resolveReviewerCase(caseId, resolution) {
  try {
    const cases = getReviewerCases();
    const c = cases.find((x) => x.id === caseId);
    if (!c) return;

    const reviewerHash = await sha256Hex(currentUser.id);
    const apiResolution =
      resolution === 'APPROVE' ? 'APPROVE'
      : resolution === 'REJECT' ? 'REJECT'
      : 'SWITCH_LEAVE_TYPE';

    const overridePayload = {
      decision_id: crypto.randomUUID(),
      request_id: crypto.randomUUID(),
      reviewer_id: reviewerHash,
      resolution: apiResolution,
      reviewer_notes: `Quản trị viên ${currentUser.name} đã xét duyệt quyết định trên Reviewer Portal.`,
      override_at: new Date().toISOString(),
    };

    if (apiResolution === 'SWITCH_LEAVE_TYPE') {
      overridePayload.new_leave_type = 'UNPAID';
    }

    const res = await fetch(`${API_BASE}/api/v1/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overridePayload),
    });

    if (!res.ok) {
      console.warn('Override response non-200', await res.text());
    }

    if (resolution === 'APPROVE') {
      c.status = 'APPROVED';
      c.statusLabel = 'Đã phê duyệt (Override)';
    } else if (resolution === 'REJECT') {
      c.status = 'REJECTED';
      c.statusLabel = 'Đã từ chối (Override)';
    } else {
      c.status = 'APPROVED';
      c.statusLabel = 'Đổi sang Nghỉ không lương';
    }

    saveReviewerCases(cases);
    renderReviewerCases();
    showToast(`Đã lưu quyết định cho hồ sơ: ${c.applicantName}`, 'success');
  } catch (err) {
    console.error('Override error', err);
    showToast('Lỗi khi gửi quyết định phê duyệt.', 'error');
  }
}

async function runReviewerRejudge(caseId) {
  const cases = getReviewerCases();
  const c = cases.find((x) => x.id === caseId);
  if (!c) return;

  const btn = document.getElementById(`btn-rejudge-${caseId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner dark" style="width:12px;height:12px;border-width:2px"></span> Đang thẩm định...`;
  }

  try {
    const docs = [];
    if (c.docUrl) {
      try {
        const res = await fetch(c.docUrl);
        const blob = await res.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        docs.push({
          document_id: crypto.randomUUID(),
          form_type: c.leaveType === 'SICK' ? 'C65-HD' : 'ĐƠN XIN NGHỈ PHÉP',
          content_ref: base64,
          mime_type: blob.type || 'image/jpeg',
        });
      } catch (err) {
        console.warn('Could not attach doc for rejudge', err);
      }
    }

    const payload = {
      request_id: crypto.randomUUID(),
      employee_id: await sha256Hex(c.applicantId || 'c_applicant'),
      employee_name: c.applicantName,
      employment_status: 'CONFIRMED',
      leave_type: c.leaveType,
      start_date: c.startDate,
      end_date: c.endDate,
      days_requested: c.days,
      leave_balance: {
        annual_days_remaining: 10,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 0,
        unpaid_days_used_ytd: 0,
      },
      attached_documents: docs,
      submitted_at: new Date().toISOString(),
    };

    const res = await fetch(`${API_BASE}/api/v1/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    c.decisionId = result.decision_id;
    c.note = `AI thẩm định (${result.outcome}): ${result.policy_basis}`;
    if (result.outcome === 'AUTO_APPROVE') {
      c.status = 'APPROVED';
      c.statusLabel = 'Tự động duyệt';
    } else if (result.outcome === 'REJECT') {
      c.status = 'REJECTED';
      c.statusLabel = 'Từ chối tự động';
    } else {
      c.status = 'PENDING';
      c.statusLabel = 'Cần phê duyệt (HITL)';
    }

    addHistoryRecord({
      id: result.decision_id || crypto.randomUUID(),
      decision_id: result.decision_id || crypto.randomUUID(),
      request_id: payload.request_id,
      time: result.evaluated_at || new Date().toISOString(),
      employee_name: c.applicantName,
      leave_type: c.leaveType,
      days: c.days,
      outcome: result.outcome,
      uncertainty_category: result.uncertainty_category || 'NONE',
      policy_basis: result.policy_basis || '',
      escalation_question: result.escalation_question || '',
      cryptographic_receipt: result.cryptographic_receipt || '',
      manager_action: null,
    });

    saveReviewerCases(cases);
    renderReviewerCases();
    showToast(`Đã thẩm định lại hồ sơ: ${c.applicantName} (${result.outcome})`, 'success');
  } catch (err) {
    console.error('Rejudge error', err);
    showToast('Lỗi khi thẩm định lại hồ sơ.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Thẩm Định Lại (Rejudge)`;
    }
  }
}

async function runReviewerCheckAll() {
  const btn = document.getElementById('btn-reviewer-check-all');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner dark" style="width:12px;height:12px;border-width:2px"></span> Đang quét...`;
  }

  const cases = getReviewerCases();
  let count = 0;
  for (const c of cases) {
    await runReviewerRejudge(c.id);
    count++;
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Thẩm Định Tất Cả`;
  }

  showToast(`Đã hoàn thành thẩm định tự động cho ${count} hồ sơ`, 'success');
}

// ── Audit Ledger (Sổ Cái Kiểm Toán Toàn Hệ Thống) ───────────────────────────
function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEDGER_HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading history', e);
  }

  // Initial seed data if first time
  const seed = [
    {
      id: 'd9b73468-12c4-4bf8-bfa9-4a0b22a01201',
      decision_id: 'd9b73468-12c4-4bf8-bfa9-4a0b22a01201',
      request_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      time: new Date(Date.now() - 3600000 * 4).toISOString(),
      employee_name: 'Lê Thị Phương',
      leave_type: 'SICK',
      days: 10,
      outcome: 'ESCALATE',
      uncertainty_category: 'U1_DATA',
      policy_basis: 'Điều 7.1 — Nghỉ ốm đau dài ngày cần đối soát con dấu mộc đỏ cơ sở y tế theo Thông tư 56/2017/TT-BYT.',
      escalation_question: 'Xác thực tính hợp lệ của mộc đỏ Bệnh viện Quận 1 trên mẫu C65-HD đính kèm.',
      cryptographic_receipt: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      manager_action: null,
    },
    {
      id: 'e1a84739-55e1-4c19-8ef2-9b0d33e04312',
      decision_id: 'e1a84739-55e1-4c19-8ef2-9b0d33e04312',
      request_id: '8a0cea3c-2a6c-4cad-8acc-1a0c6a2cba5c',
      time: new Date(Date.now() - 3600000 * 18).toISOString(),
      employee_name: 'Nguyễn Thị Hương',
      leave_type: 'ANNUAL',
      days: 1,
      outcome: 'AUTO_APPROVE',
      uncertainty_category: 'NONE',
      policy_basis: 'Điều 10.1 — Nghỉ phép năm có hưởng lương trong hạn mức quỹ ngày phép tích lũy.',
      escalation_question: '',
      cryptographic_receipt: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      manager_action: null,
    },
    {
      id: 'f4c92817-66a2-4d22-9df3-1c2e44f05423',
      decision_id: 'f4c92817-66a2-4d22-9df3-1c2e44f05423',
      request_id: '79fbd92b-195b-4b9c-79bb-09fb591ba94b',
      time: new Date(Date.now() - 3600000 * 30).toISOString(),
      employee_name: 'Trần Văn Nam',
      leave_type: 'ANNUAL',
      days: 2,
      outcome: 'REJECT',
      uncertainty_category: 'NONE',
      policy_basis: 'Điều 8.2 — Hợp đồng lao động đang trong thời gian thử việc không được hưởng chế độ phép năm có lương.',
      escalation_question: '',
      cryptographic_receipt: '9f8e7d6c5b4a3928170e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
      manager_action: null,
    },
    {
      id: 'c2b61948-77b3-4f33-8fe4-2d3a55b06534',
      decision_id: 'c2b61948-77b3-4f33-8fe4-2d3a55b06534',
      request_id: '68eac81a-084a-4a8b-68aa-f8ea480a983a',
      time: new Date(Date.now() - 3600000 * 50).toISOString(),
      employee_name: 'Hoàng Hải Đăng',
      leave_type: 'UNPAID',
      days: 12,
      outcome: 'ESCALATE',
      uncertainty_category: 'U3_AUTHORITY',
      policy_basis: 'Điều 12.3 — Nghỉ không lương trên 10 ngày vượt hạn mức duyệt của Trưởng bộ phận, cần Giám đốc phê chuẩn.',
      escalation_question: 'Phê chuẩn thời gian nghỉ không lương 12 ngày liên tục?',
      cryptographic_receipt: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      manager_action: {
        resolution: 'APPROVE',
        receipt: '5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
        at: new Date(Date.now() - 3600000 * 48).toISOString(),
      },
    },
  ];

  localStorage.setItem(STORAGE_KEYS.LEDGER_HISTORY, JSON.stringify(seed));
  return seed;
}

function saveHistory(items) {
  localStorage.setItem(STORAGE_KEYS.LEDGER_HISTORY, JSON.stringify(items));
}

function addHistoryRecord(record) {
  const items = loadHistory();
  items.unshift(record);
  saveHistory(items);
}

function clearLedgerHistory() {
  if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong Sổ Cái Kiểm Toán?')) return;
  localStorage.removeItem(STORAGE_KEYS.LEDGER_HISTORY);
  renderLedger();
  showToast('Đã xóa dữ liệu Sổ Cái Kiểm Toán', 'info');
}

function filterLedgerTable() {
  renderLedger();
}

function toggleLedgerRow(idx) {
  const row = document.getElementById(`exp-${idx}`);
  if (row) row.classList.toggle('open');
}

function openLedgerRow(idx) {
  const row = document.getElementById(`exp-${idx}`);
  if (row) {
    row.classList.add('open');
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderLedger() {
  const items = loadHistory();
  const search = (document.getElementById('ledger-search-input')?.value || '').toLowerCase().trim();
  const filterOutcome = document.getElementById('ledger-filter-outcome')?.value || 'ALL';

  // Stats calculation
  const total = items.length;
  const approve = items.filter(
    (i) => i.outcome === 'AUTO_APPROVE' || i.manager_action?.resolution === 'APPROVE' || i.manager_action?.resolution === 'SWITCH_LEAVE_TYPE'
  ).length;
  const totalEscalate = items.filter((i) => i.outcome === 'ESCALATE').length;
  const pendingEscalate = items.filter((i) => i.outcome === 'ESCALATE' && !i.manager_action).length;
  const reject = items.filter((i) => i.outcome === 'REJECT' || i.manager_action?.resolution === 'REJECT').length;

  const statTotalEl = document.getElementById('stat-total');
  const statApproveEl = document.getElementById('stat-approve');
  const statEscalateEl = document.getElementById('stat-escalate');
  const statEscalateSubEl = document.getElementById('stat-escalate-sub');
  const statRejectEl = document.getElementById('stat-reject');

  if (statTotalEl) statTotalEl.textContent = total;
  if (statApproveEl) statApproveEl.textContent = approve;
  if (statEscalateEl) statEscalateEl.textContent = totalEscalate;
  if (statEscalateSubEl) {
    statEscalateSubEl.textContent = pendingEscalate > 0 ? `${pendingEscalate} đơn chờ phân quyết` : 'Đã xử lý xong';
  }
  if (statRejectEl) statRejectEl.textContent = reject;

  // Filter items
  const filtered = items.filter((item) => {
    if (filterOutcome !== 'ALL') {
      if (item.outcome !== filterOutcome) return false;
    }
    if (search) {
      const target = `${item.employee_name || ''} ${item.leave_type || ''} ${item.decision_id || ''} ${item.policy_basis || ''}`.toLowerCase();
      if (!target.includes(search)) return false;
    }
    return true;
  });

  const cont = document.getElementById('ledger-content');
  if (!cont) return;

  if (!filtered.length) {
    cont.innerHTML = `
      <div style="text-align:center; padding:48px 16px; color:var(--neutral-500)">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4; margin-bottom:8px">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="font-size:13px; margin:0">Không tìm thấy bản ghi kiểm toán phù hợp.</p>
      </div>
    `;
    return;
  }

  const rows = filtered
    .map((item, idx) => {
      const itemTime = item.time ? new Date(item.time).toLocaleString('vi-VN') : '—';
      const itemEmpName = item.employee_name || 'Nhân Viên';
      const itemLeaveType = item.leave_type || 'ANNUAL';
      const itemDays = item.days || 1;
      const itemDecisionId = item.decision_id || item.id || '—';
      const itemUnc = item.uncertainty_category || 'NONE';
      const itemPolicy = item.policy_basis || '—';
      const itemQuestion = item.escalation_question || '';
      const itemReceipt = item.cryptographic_receipt || '—';

      let aiBadge = '<span class="status-badge approved">Duyệt tự động</span>';
      if (item.outcome === 'ESCALATE') {
        aiBadge = `<span class="status-badge pending">Phân quyết (HITL)</span>`;
      } else if (item.outcome === 'REJECT') {
        aiBadge = '<span class="status-badge rejected">Từ chối</span>';
      }

      let hitlStatusHtml = '';
      if (item.outcome === 'ESCALATE') {
        if (item.manager_action) {
          const res = item.manager_action.resolution;
          const badgeClass = res === 'APPROVE' ? 'approved' : res === 'REJECT' ? 'rejected' : 'pending';
          const label = res === 'APPROVE' ? 'Quản lý: Phê chuẩn' : res === 'REJECT' ? 'Quản lý: Từ chối' : 'Quản lý: Đổi sang nghỉ KL';
          hitlStatusHtml = `<span class="status-badge ${badgeClass}">${label}</span>`;
        } else {
          hitlStatusHtml = `
            <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openLedgerRow(${idx})" style="font-size:11.5px; font-weight:700">
              Ra Quyết Định
            </button>
          `;
        }
      } else {
        hitlStatusHtml = `<span style="font-size:12px; color:var(--neutral-400)">Tự động hoàn tất</span>`;
      }

      let hitlBlock = '';
      if (item.outcome === 'ESCALATE') {
        if (!item.manager_action) {
          hitlBlock = `
            <div class="hitl-box pending">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                <span style="font-weight:700; font-size:13px; color:#b45309">Yêu Cầu Phân Quyết Quản Trị (Human-in-the-Loop Override)</span>
                <span class="status-badge pending">${itemUnc}</span>
              </div>
              <p style="font-size:12.5px; color:var(--neutral-800); margin:0 0 10px; line-height:1.5">
                ${itemQuestion || 'Hồ sơ có dấu hiệu cần đối soát hoặc vượt hạn mức thẩm quyền thông thường.'}
              </p>
              <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button type="button" class="btn btn-success btn-sm" onclick="event.stopPropagation(); handleLedgerOverride(${idx}, 'APPROVE')">
                  Phê Chuẩn Đặc Cách (Approve)
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="event.stopPropagation(); handleLedgerOverride(${idx}, 'REJECT')">
                  Bác Bỏ / Từ Chối (Reject)
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); handleLedgerOverride(${idx}, 'SWITCH_LEAVE_TYPE', 'UNPAID')">
                  Chuyển Nghỉ Không Lương (Unpaid)
                </button>
              </div>
            </div>
          `;
        } else {
          hitlBlock = `
            <div class="hitl-box resolved">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
                <span style="font-weight:700; font-size:13px; color:#166534">Đã Được Phân Xử Bởi Quản Lý (Overridden)</span>
                <span class="status-badge approved">${item.manager_action.resolution}</span>
              </div>
              <div style="font-size:12px; color:#15803d; line-height:1.5">
                Thời gian xử lý: <strong>${new Date(item.manager_action.at).toLocaleString('vi-VN')}</strong><br>
                Mã biên nhận quản lý: <code style="font-family:monospace; background:rgba(0,0,0,0.05); padding:2px 4px; border-radius:4px">${item.manager_action.receipt}</code>
              </div>
            </div>
          `;
        }
      }

      return `
        <tr onclick="toggleLedgerRow(${idx})" style="cursor:pointer" title="Nhấp để xem chi tiết đối soát">
          <td style="font-size:12px; color:var(--neutral-500)">${itemTime}</td>
          <td><strong>${itemEmpName}</strong></td>
          <td><span style="font-size:12px; font-weight:600">${itemLeaveType}</span></td>
          <td><strong>${itemDays} ngày</strong></td>
          <td>${aiBadge}</td>
          <td>${hitlStatusHtml}</td>
          <td><code style="font-family:monospace; font-size:11.5px; color:var(--neutral-500)">${itemDecisionId.slice(0, 13)}…</code></td>
        </tr>
        <tr class="expand-row" id="exp-${idx}">
          <td colspan="7">
            <div class="expand-inner">
              <div class="expand-field">
                <label>Mã Quyết Định (Decision ID)</label>
                <p style="font-family:monospace; font-size:11.5px">${itemDecisionId}</p>
              </div>
              <div class="expand-field">
                <label>Thời Điểm Thẩm Định</label>
                <p>${itemTime}</p>
              </div>
              <div class="expand-field">
                <label>Phân Loại Rủi Ro (Uncertainty Category)</label>
                <p><span class="status-badge pending" style="font-size:11px">${itemUnc}</span></p>
              </div>
              <div class="expand-field full">
                <label>Căn Cứ Pháp Lý &amp; Quy Chế Nội Bộ</label>
                <p>${itemPolicy}</p>
              </div>
              <div class="expand-field full">
                <label>Mã Biên Nhận Mật Mã (SHA-256 Receipt)</label>
                <p style="font-family:monospace; font-size:11.5px; color:var(--neutral-600)">${itemReceipt}</p>
              </div>
              ${hitlBlock}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  cont.innerHTML = `
    <div class="table-wrapper" style="border:none; border-radius:0">
      <table class="corporate-table">
        <thead>
          <tr>
            <th>Thời Gian</th>
            <th>Nhân Viên</th>
            <th>Chế Độ Nghỉ</th>
            <th>Số Ngày</th>
            <th>Kết Quả AI</th>
            <th>Trạng Thái Phân Xử (HITL)</th>
            <th>Mã Biên Nhận / ID</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

async function handleLedgerOverride(idx, resolution, newLeaveType = 'UNPAID') {
  const items = loadHistory();
  const item = items[idx];
  if (!item) return;

  const decisionId = isUuid(item.decision_id) ? item.decision_id : (isUuid(item.id) ? item.id : crypto.randomUUID());
  const requestId = isUuid(item.request_id) ? item.request_id : crypto.randomUUID();

  try {
    const reviewerHash = await sha256Hex(currentUser.id);
    const payloadBody = {
      decision_id: decisionId,
      request_id: requestId,
      reviewer_id: reviewerHash,
      resolution: resolution,
      reviewer_notes:
        resolution === 'APPROVE'
          ? `Ký duyệt phê chuẩn đặc cách trực tiếp từ Sổ Cái Kiểm Toán bởi ${currentUser.name}.`
          : resolution === 'SWITCH_LEAVE_TYPE'
          ? `Chuyển sang hình thức nghỉ không lương (${newLeaveType}) bởi ${currentUser.name}.`
          : `Bác bỏ / Từ chối yêu cầu trực tiếp từ Sổ Cái Kiểm Toán bởi ${currentUser.name}.`,
      override_at: new Date().toISOString(),
    };

    if (resolution === 'SWITCH_LEAVE_TYPE') {
      payloadBody.new_leave_type = newLeaveType;
    }

    const resp = await fetch(`${API_BASE}/api/v1/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBody),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || data?.message || 'Override request failed');

    item.decision_id = decisionId;
    item.request_id = requestId;
    item.manager_action = {
      resolution: resolution,
      receipt: data.cryptographic_receipt || crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      at: data.recorded_at || new Date().toISOString(),
      new_leave_type: newLeaveType,
    };

    saveHistory(items);
    renderLedger();
    toggleLedgerRow(idx);
    showToast(`Đã lưu phân xử thành công: ${resolution}`, 'success');
  } catch (err) {
    console.error('Ledger override error', err);
    showToast('Lỗi khi ghi nhận phân xử: ' + err.message, 'error');
  }
}

// ── Smoke Tests Suite (5 Canonical Cases) ───────────────────────────────────
const SMOKE_CASES = [
  {
    id: 'sc1',
    expected: 'AUTO_APPROVE',
    title: 'Nhân viên chính thức — Nghỉ phép năm chuẩn',
    desc: 'Trạng thái CONFIRMED + Phép năm ANNUAL + 3 ngày nằm trong hạn mức 10 ngày còn lại. Tất cả quy định thỏa mãn, hệ thống tự động phê chuẩn.',
    tags: [['CONFIRMED', 'blue'], ['ANNUAL', 'blue'], ['3 ngày', 'green']],
    payload: {
      employee_name: 'Smoke Test User 1',
      employment_status: 'CONFIRMED',
      leave_type: 'ANNUAL',
      days_requested: 3,
      leave_balance: { annual_days_remaining: 10, sick_days_remaining: 30, maternity_weeks_remaining: 0, unpaid_days_used_ytd: 0 },
    },
  },
  {
    id: 'sc2',
    expected: 'REJECT',
    expectedNote: 'Điều 8.2',
    title: 'Nhân viên thử việc — Nghỉ phép năm (Điều 8.2)',
    desc: 'Trạng thái PROBATION không được hưởng chế độ phép năm có lương theo quy định Điều 8.2. Hệ thống từ chối tự động.',
    tags: [['PROBATION', 'red'], ['ANNUAL', 'blue'], ['2 ngày', 'gray']],
    payload: {
      employee_name: 'Smoke Test User 2',
      employment_status: 'PROBATION',
      leave_type: 'ANNUAL',
      days_requested: 2,
      leave_balance: { annual_days_remaining: 10, sick_days_remaining: 30, maternity_weeks_remaining: 0, unpaid_days_used_ytd: 0 },
    },
  },
  {
    id: 'sc3',
    expected: 'REJECT',
    expectedNote: 'Điều 9.1',
    title: 'Nhân viên thôi việc — Nghỉ ốm đau (Điều 9.1)',
    desc: 'Trạng thái RESIGNED vô hiệu hóa toàn bộ quyền lợi bảo hiểm và ngày phép của doanh nghiệp theo Điều 9.1.',
    tags: [['RESIGNED', 'red'], ['SICK', 'blue'], ['3 ngày', 'gray']],
    payload: {
      employee_name: 'Smoke Test User 3',
      employment_status: 'RESIGNED',
      leave_type: 'SICK',
      days_requested: 3,
      leave_balance: { annual_days_remaining: 5, sick_days_remaining: 30, maternity_weeks_remaining: 0, unpaid_days_used_ytd: 0 },
    },
  },
  {
    id: 'sc4',
    expected: 'ESCALATE',
    expectedNote: 'U3_AUTHORITY',
    title: 'Chính thức nghỉ dài ngày — Vượt hạn mức thẩm quyền (U3_AUTHORITY)',
    desc: 'Nghỉ phép năm 8 ngày vượt quá hạn mức phê duyệt của Trưởng nhóm, kích hoạt quy trình phân xử quản lý cấp cao.',
    tags: [['CONFIRMED', 'blue'], ['ANNUAL', 'blue'], ['8 ngày', 'yellow']],
    payload: {
      employee_name: 'Smoke Test User 4',
      employment_status: 'CONFIRMED',
      leave_type: 'ANNUAL',
      days_requested: 8,
      leave_balance: { annual_days_remaining: 15, sick_days_remaining: 30, maternity_weeks_remaining: 0, unpaid_days_used_ytd: 0 },
    },
  },
  {
    id: 'sc5',
    expected: 'ESCALATE',
    expectedNote: 'U2_POLICY',
    title: 'Thử việc xin nghỉ thai sản — Xung đột chính sách (U2_POLICY)',
    desc: 'Nhân sự thử việc xin nghỉ thai sản 84 ngày tạo ra điểm mơ hồ giữa luật lao động và quy chế thử việc, cần cấp quản lý quyết định.',
    tags: [['PROBATION', 'red'], ['MATERNITY', 'blue'], ['84 ngày', 'yellow']],
    payload: {
      employee_name: 'Smoke Test User 5',
      employment_status: 'PROBATION',
      leave_type: 'MATERNITY',
      days_requested: 84,
      leave_balance: { annual_days_remaining: 0, sick_days_remaining: 30, maternity_weeks_remaining: 26, unpaid_days_used_ytd: 0 },
    },
  },
];

function renderSmokeSuite() {
  const grid = document.getElementById('smoke-grid');
  if (!grid) return;

  grid.innerHTML = SMOKE_CASES.map((sc, i) => {
    const tagsHtml = sc.tags
      .map(([t, c]) => `<span class="smoke-tag">${t}</span>`)
      .join('');

    let expBadgeClass = 'approved';
    if (sc.expected === 'ESCALATE') expBadgeClass = 'pending';
    else if (sc.expected === 'REJECT') expBadgeClass = 'rejected';

    return `
      <div class="smoke-card" id="scard-${sc.id}">
        <div class="smoke-card-top">
          <div style="flex:1">
            <div class="smoke-card-name">${sc.title}</div>
            <div class="smoke-tag-list">${tagsHtml}</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="sbtn-${sc.id}" onclick="runSmokeTest('${sc.id}', ${i})">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Chạy
          </button>
        </div>
        <div class="smoke-desc">${sc.desc}</div>
        <div class="smoke-outcome-bar">
          <div>Kỳ vọng: <span class="status-badge ${expBadgeClass}">${sc.expected}</span> ${sc.expectedNote ? `<span style="font-size:10.5px; color:var(--neutral-500)">(${sc.expectedNote})</span>` : ''}</div>
        </div>
        <div id="sres-${sc.id}"></div>
      </div>
    `;
  }).join('');
}

async function runSmokeTest(id, idx) {
  const sc = SMOKE_CASES[idx];
  const btn = document.getElementById('sbtn-' + id);
  const res = document.getElementById('sres-' + id);

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner dark" style="width:11px;height:11px;border-width:2px"></span>`;
  }
  if (res) {
    res.innerHTML = `<div class="smoke-result running"><span class="spinner dark" style="width:11px;height:11px;border-width:2px"></span> Đang chạy kiểm thử...</div>`;
  }

  const today = new Date();
  const formatD = (d) => d.toISOString().split('T')[0];
  const startDate = formatD(today);
  const endD = new Date(today);
  endD.setDate(today.getDate() + (sc.payload.days_requested - 1));
  const endDate = formatD(endD);

  const payload = Object.assign(
    {
      request_id: crypto.randomUUID(),
      employee_id: await sha256Hex('smoke_user_' + id),
      start_date: startDate,
      end_date: endDate,
      attached_documents: [],
      submitted_at: new Date().toISOString(),
    },
    sc.payload
  );

  const t0 = performance.now();
  let actual = null;
  let errMsg = null;

  try {
    const response = await fetch(`${API_BASE}/api/v1/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    const latency = Math.round(performance.now() - t0);
    actual = result.outcome;
    const isPass = actual === sc.expected;

    if (res) {
      res.innerHTML = `
        <div class="smoke-result ${isPass ? 'pass' : 'fail'}">
          <span class="passfail-badge ${isPass ? 'pass' : 'fail'}">${isPass ? 'PASS' : 'FAIL'}</span>
          <span style="flex:1">Kết quả: <strong>${actual}</strong> (${latency}ms)</span>
          ${result.uncertainty_category && result.uncertainty_category !== 'NONE' ? `<span class="status-badge pending" style="font-size:10px">${result.uncertainty_category}</span>` : ''}
        </div>
        <div style="font-size:11.5px; color:var(--neutral-500); margin-top:6px; line-height:1.4">${result.policy_basis || ''}</div>
      `;
    }

    addHistoryRecord({
      id: result.decision_id || crypto.randomUUID(),
      decision_id: result.decision_id || crypto.randomUUID(),
      request_id: payload.request_id,
      time: result.evaluated_at || new Date().toISOString(),
      employee_name: payload.employee_name,
      leave_type: payload.leave_type,
      days: payload.days_requested,
      outcome: result.outcome,
      uncertainty_category: result.uncertainty_category || 'NONE',
      policy_basis: result.policy_basis || '',
      escalation_question: result.escalation_question || '',
      cryptographic_receipt: result.cryptographic_receipt || '',
      manager_action: null,
    });

    return { pass: isPass };
  } catch (err) {
    errMsg = err.message;
    if (res) {
      res.innerHTML = `<div class="smoke-result fail"><span class="passfail-badge fail">FAIL</span> <span>Lỗi: ${err.message}</span></div>`;
    }
    return { pass: false };
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Chạy lại`;
    }
  }
}

async function runAllSmokeTests() {
  const btn = document.getElementById('btn-run-all-smoke');
  const sumBox = document.getElementById('smoke-summary-stats');
  const passEl = document.getElementById('smoke-sum-pass');
  const failEl = document.getElementById('smoke-sum-fail');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner dark" style="width:12px;height:12px;border-width:2px"></span> Đang chạy toàn bộ...`;
  }
  if (sumBox) sumBox.style.display = 'none';

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < SMOKE_CASES.length; i++) {
    const { pass } = await runSmokeTest(SMOKE_CASES[i].id, i);
    if (pass) passed++;
    else failed++;
  }

  if (passEl) passEl.textContent = `${passed} Đạt`;
  if (failEl) failEl.textContent = `${failed} Thất bại`;
  if (sumBox) sumBox.style.display = 'inline-flex';

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Chạy Toàn Bộ 5 Ca Kiểm Thử`;
  }

  showToast(`Hoàn tất kiểm thử: ${passed}/5 ca đạt chuẩn`, 'info');
}

// ── OCR / VLM Tester ────────────────────────────────────────────────────────
let vlmFileData = null;

function vlmFileSelected(e) {
  const file = e.target.files?.[0];
  if (file) vlmLoadFile(file);
}

function vlmLoadFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    alert('Định dạng tệp không được hỗ trợ. Vui lòng tải lên ảnh JPG, PNG hoặc WEBP.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    vlmFileData = { dataUrl: e.target.result, name: file.name, mimeType: file.type };
    const img = document.getElementById('vlm-preview-img');
    const placeholder = document.getElementById('vlm-preview-placeholder');
    const info = document.getElementById('vlm-file-info');
    const btn = document.getElementById('btn-vlm-analyze');
    const statusText = document.getElementById('vlm-status-text');

    if (img) {
      img.src = e.target.result;
      img.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (info) {
      info.textContent = `Tệp: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      info.style.display = 'block';
    }
    if (btn) btn.disabled = false;
    if (statusText) statusText.textContent = 'Tài liệu đã sẵn sàng thẩm định thị giác.';
  };
  reader.readAsDataURL(file);
}

async function vlmLoadSampleMedical() {
  const url = '/cases/case_01_le_thi_phuong/bang_chung_le_thi_phuong.jpg';
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'giay_chung_nhan_c65_hd_le_thi_phuong.jpg', { type: blob.type || 'image/jpeg' });
    vlmLoadFile(file);
    showToast('Đã nạp mẫu chứng từ C65-HD (Mộc đỏ BV Quận 1)', 'info');
  } catch (err) {
    console.error('Cannot load sample image', err);
    showToast('Lỗi khi nạp hình ảnh mẫu.', 'error');
  }
}

function vlmClear() {
  vlmFileData = null;
  const img = document.getElementById('vlm-preview-img');
  const placeholder = document.getElementById('vlm-preview-placeholder');
  const info = document.getElementById('vlm-file-info');
  const btn = document.getElementById('btn-vlm-analyze');
  const statusText = document.getElementById('vlm-status-text');
  const resultsArea = document.getElementById('vlm-results-area');
  const rawLog = document.getElementById('vlm-raw-log');
  const badge = document.getElementById('vlm-outcome-badge');

  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'block';
  if (info) info.style.display = 'none';
  if (btn) btn.disabled = true;
  if (statusText) statusText.textContent = 'Vui lòng nạp tài liệu trước khi phân tích';
  if (badge) badge.style.display = 'none';
  if (rawLog) rawLog.textContent = 'Đang chờ lệnh...';
  if (resultsArea) {
    resultsArea.innerHTML = `
      <div style="text-align:center; padding:48px 16px; color:var(--neutral-400)">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4; margin-bottom:10px">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="font-size:13px; margin:0">Nạp chứng từ và nhấn "Thẩm Định Tài Liệu" để trích xuất dữ liệu.</p>
      </div>
    `;
  }
}

function toggleVlmJson() {
  const log = document.getElementById('vlm-raw-log');
  if (log) {
    log.style.display = log.style.display === 'block' ? 'none' : 'block';
  }
}

async function vlmAnalyzeDocument() {
  if (!vlmFileData) return;
  const btn = document.getElementById('btn-vlm-analyze');
  const statusText = document.getElementById('vlm-status-text');
  const resultsArea = document.getElementById('vlm-results-area');
  const rawLog = document.getElementById('vlm-raw-log');
  const badge = document.getElementById('vlm-outcome-badge');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:14px;height:14px"></span> Đang phân tích OCR &amp; VLM...`;
  }
  if (statusText) statusText.textContent = 'Đang gửi ảnh đến mô hình OpenRouter VLM...';
  if (resultsArea) {
    resultsArea.innerHTML = `
      <div class="smoke-result running">
        <span class="spinner dark" style="width:14px;height:14px;border-width:2px"></span>
        Đang chạy nhận diện con dấu, chữ ký và phân tích ngữ nghĩa tài liệu...
      </div>
    `;
  }

  const isMedical = vlmFileData.name.toLowerCase().includes('c65');
  const formType = isMedical ? 'C65-HD' : 'ĐƠN XIN NGHỈ PHÉP';
  const leaveType = isMedical ? 'SICK' : 'ANNUAL';

  const today = new Date();
  const formatD = (d) => d.toISOString().split('T')[0];
  const startDate = formatD(today);
  const endD = new Date(today);
  endD.setDate(today.getDate() + 2);
  const endDate = formatD(endD);

  const payload = {
    request_id: crypto.randomUUID(),
    employee_id: await sha256Hex('vlm_tester_user'),
    employee_name: 'VLM Inspection User',
    employment_status: 'CONFIRMED',
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    days_requested: 3,
    leave_balance: {
      annual_days_remaining: 10,
      sick_days_remaining: 30,
      maternity_weeks_remaining: 0,
      unpaid_days_used_ytd: 0,
    },
    attached_documents: [
      {
        document_id: crypto.randomUUID(),
        form_type: formType,
        content_ref: vlmFileData.dataUrl,
        mime_type: vlmFileData.mimeType,
      },
    ],
    submitted_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (rawLog) rawLog.textContent = JSON.stringify(result, null, 2);

    const isVlmFailure = result.outcome === 'ESCALATE' && result.uncertainty_category === 'U1_DATA';

    if (badge) {
      badge.style.display = 'inline-flex';
      badge.className = `status-badge ${isVlmFailure ? 'pending' : 'approved'}`;
      badge.textContent = isVlmFailure ? 'U1_DATA (Cần bổ sung)' : 'Đã Xác Minh';
    }

    if (isVlmFailure) {
      resultsArea.innerHTML = `
        <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:var(--radius-md); padding:14px; margin-bottom:14px">
          <div style="font-weight:700; font-size:13px; color:#b45309; margin-bottom:4px">Xác Thực Chứng Từ Cần Bổ Sung (U1_DATA)</div>
          <div style="font-size:12.5px; color:var(--neutral-800); line-height:1.5">${result.policy_basis || ''}</div>
        </div>
        <div style="font-size:12.5px; color:var(--neutral-600); line-height:1.5">
          <strong>Câu hỏi điều tra:</strong> ${result.escalation_question || 'Yêu cầu nhân sự cung cấp bản gốc chứng từ có mộc nổi.'}
        </div>
      `;
    } else {
      resultsArea.innerHTML = `
        <div style="background:#f0fdf4; border:1px solid #16a34a; border-radius:var(--radius-md); padding:14px; margin-bottom:14px">
          <div style="font-weight:700; font-size:13px; color:#166534; margin-bottom:4px">Chứng Từ Đạt Chuẩn Xác Minh Thị Giác</div>
          <div style="font-size:12.5px; color:var(--neutral-800); line-height:1.5">
            Mộc đỏ và các trường thông tin trên mẫu đối soát hợp lệ. Tiến trình chuyển tiếp thành công tới engine quy tắc.
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px">
          <div style="background:var(--neutral-50); padding:10px; border-radius:4px; border:1px solid var(--border)">
            <span style="color:var(--neutral-500); display:block; font-size:11px">Kết Quả Phân Xử</span>
            <strong style="color:var(--neutral-900); font-size:13px">${result.outcome}</strong>
          </div>
          <div style="background:var(--neutral-50); padding:10px; border-radius:4px; border:1px solid var(--border)">
            <span style="color:var(--neutral-500); display:block; font-size:11px">Phân Hạng Rủi Ro</span>
            <strong style="color:var(--neutral-900); font-size:13px">${result.uncertainty_category}</strong>
          </div>
          <div style="background:var(--neutral-50); padding:10px; border-radius:4px; border:1px solid var(--border); grid-column:1/-1">
            <span style="color:var(--neutral-500); display:block; font-size:11px">Căn Cứ Quy Chế</span>
            <span style="color:var(--neutral-800); line-height:1.4">${result.policy_basis}</span>
          </div>
        </div>
      `;
    }

    addHistoryRecord({
      id: result.decision_id || crypto.randomUUID(),
      decision_id: result.decision_id || crypto.randomUUID(),
      request_id: payload.request_id,
      time: result.evaluated_at || new Date().toISOString(),
      employee_name: payload.employee_name,
      leave_type: payload.leave_type,
      days: payload.days_requested,
      outcome: result.outcome,
      uncertainty_category: result.uncertainty_category || 'NONE',
      policy_basis: result.policy_basis || '',
      escalation_question: result.escalation_question || '',
      cryptographic_receipt: result.cryptographic_receipt || '',
      manager_action: null,
    });

    showToast('Đã hoàn tất phân tích OCR & VLM', 'success');
  } catch (err) {
    console.error('VLM analyze error', err);
    if (resultsArea) {
      resultsArea.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #dc2626; border-radius:var(--radius-md); padding:14px; color:#991b1b">
          <strong>Lỗi thẩm định tài liệu:</strong> ${err.message}
        </div>
      `;
    }
    showToast('Lỗi khi phân tích chứng từ thị giác', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Thẩm Định Tài Liệu (Analyze Document)`;
    }
    if (statusText) statusText.textContent = 'Phân tích hoàn tất.';
  }
}

// ── Modals & Quick Viewers ──────────────────────────────────────────────────
function openImageModal(imgSrc) {
  const modal = document.getElementById('modal-image-preview');
  const img = document.getElementById('modal-preview-img');
  if (modal && img) {
    img.src = imgSrc;
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// ── Health Check ────────────────────────────────────────────────────────────
async function checkBackendHealth() {
  const dot = document.getElementById('server-status-dot');
  const text = document.getElementById('server-status-text');
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className = 'sys-dot online';
      text.textContent = 'Hệ thống trực tuyến';
    } else {
      dot.className = 'sys-dot offline';
      text.textContent = 'Máy chủ phản hồi lỗi';
    }
  } catch {
    dot.className = 'sys-dot offline';
    text.textContent = 'Mất kết nối máy chủ';
  }
}

// ── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatD = (d) => d.toISOString().split('T')[0];
  document.getElementById('input-start-date').value = formatD(today);
  document.getElementById('input-end-date').value = formatD(tomorrow);
  updateDaysRequested();

  document.getElementById('input-start-date').addEventListener('change', updateDaysRequested);
  document.getElementById('input-end-date').addEventListener('change', updateDaysRequested);
  document.getElementById('impact-delegate').addEventListener('change', renderImpactAssessment);

  document.getElementById('form-leave-request').addEventListener('submit', handleLeaveSubmit);
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  initFileUpload();

  if (!getSavedRequests().length) {
    saveUserRequest({
      id: 'REQ-1001',
      requestId: crypto.randomUUID(),
      leaveType: 'ANNUAL',
      days: 1,
      employeeId: 'NV-2024-0312',
      department: 'Phòng Kinh doanh',
      startDate: '2026-09-15',
      endDate: '2026-09-15',
      reason: 'Khám sức khỏe định kỳ',
      status: 'AUTO_APPROVE',
      decisionReceipt: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      policyBasis: 'Điều 10.1 — Nghỉ phép năm có lương',
      submittedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    });
  }

  await restoreSession();
  checkBackendHealth();
  setInterval(checkBackendHealth, 15000);
});
