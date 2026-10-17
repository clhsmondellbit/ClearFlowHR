import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  LeaveBalanceSchema,
  type LeaveBalance,
  type LeaveType,
} from "../api/routes/schemas.js";

export type AccountRole = "EMPLOYEE" | "MANAGER" | "DIRECTOR";

export interface UserAccount {
  username: string;
  employeeId: string;
  name: string;
  role: AccountRole;
  roleTitle: string;
  department: string;
  status: "CONFIRMED";
  avatar: string;
  balance: {
    annual: number;
    annualTotal: number;
    sick: number;
    maternity: number;
    unpaid: number;
  };
  salt: string;
  passwordHash: string;
}

export const USER_ACCOUNTS: UserAccount[] = [
  {
    username: "nhu.hoang", employeeId: "NV-2024-0312", name: "Nguyễn Thị Hương",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Kinh doanh",
    status: "CONFIRMED", avatar: "NH",
    balance: { annual: 4, annualTotal: 12, sick: 30, maternity: 26, unpaid: 0 },
    salt: "08c8ce6f17199cf5e20a7f7bdeedb2f6",
    passwordHash: "e6870d02b24dd7540bfcbd7bd26c013d5098eba413e33267675ab08c5df397bc5a9bf3bf67898620022480f52bedbfdd023349bbb923cf2c785aaff9dd9e6057",
  },
  {
    username: "bao.tran", employeeId: "NV-2024-0313", name: "Trần Minh Bảo",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Kinh doanh",
    status: "CONFIRMED", avatar: "TB",
    balance: { annual: 8, annualTotal: 12, sick: 30, maternity: 0, unpaid: 0 },
    salt: "a90bfc59c956ec5497710bc35886a38b",
    passwordHash: "02ad96bb0b56de1ab5e7d8cd83cf7dbce8afe4098632f481d126e4ec9a1aed0a4127291da14fdb0cfcee4d1548746e4c1668967d4d6249fef760f8e147f15b00",
  },
  {
    username: "khanh.le", employeeId: "NV-2024-0211", name: "Lê Khánh Linh",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Kế hoạch & Sản xuất",
    status: "CONFIRMED", avatar: "LK",
    balance: { annual: 9, annualTotal: 14, sick: 30, maternity: 26, unpaid: 0 },
    salt: "588482946f5e8b7583227ecb1a3923b7",
    passwordHash: "6ce2e49b9a82a53a09eaf4e80cb55fa594d8afba09d6985154c9b2ef485ee97275771c6b9fb3b7753cd617a9a772914f9be23921feb7641375734cd2c15bb89a",
  },
  {
    username: "phuong.vo", employeeId: "NV-2024-0212", name: "Võ Minh Phương",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Kế hoạch & Sản xuất",
    status: "CONFIRMED", avatar: "VP",
    balance: { annual: 12, annualTotal: 14, sick: 30, maternity: 26, unpaid: 0 },
    salt: "1adce1475aae881c9a773ede5c829955",
    passwordHash: "7959f58e7a85c9f813271515ccc4cc46669cd06a951e36cd4e89fb78dd09ca3bf32d62a3a46ccfb962b24362250dae0057a96397baff18167afb0c8bbd089d17",
  },
  {
    username: "duy.pham", employeeId: "NV-2024-0301", name: "Phạm Quốc Duy",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Công nghệ",
    status: "CONFIRMED", avatar: "PD",
    balance: { annual: 6, annualTotal: 12, sick: 30, maternity: 0, unpaid: 0 },
    salt: "427909598a7505dbad9018c6e61a307e",
    passwordHash: "898743f0a28a3c294fc2c3e748cca12e151f7ab040d3bd229089ba294eb02d799b157d4a60fc9ac8f3374c166d4c6e11a93d23ce313c134a46e5e1c25186a574",
  },
  {
    username: "lan.nguyen", employeeId: "NV-2024-0310", name: "Nguyễn Thu Lan",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Nhân sự & Tuân thủ",
    status: "CONFIRMED", avatar: "NL",
    balance: { annual: 5, annualTotal: 12, sick: 30, maternity: 26, unpaid: 0 },
    salt: "254f359f54cd5922a28046cddbbc3dfe",
    passwordHash: "c8b10d61e6d3fc304dc810649dc56c253aedfdd2bf1848ecdc658401d036e28b1b73bc7eca16e1ba56f08e7268c1762c3482aca512cefbc3524259e9e3f5b13b",
  },
  {
    username: "minh.ngo", employeeId: "NV-2024-0302", name: "Ngô Quang Minh",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Công nghệ",
    status: "CONFIRMED", avatar: "NM",
    balance: { annual: 10, annualTotal: 12, sick: 30, maternity: 0, unpaid: 0 },
    salt: "cd09de8bf3a9340e65d10fce498983c2",
    passwordHash: "b3437ade3d41a47400268e4c2f00c8d5373a79be09d7419831baf557b449650f96d075af2ae52dfb8019c255976efb4aa3d967174f0d4fb2774441a4d778b88c",
  },
  {
    username: "thao.bui", employeeId: "NV-2024-0311", name: "Bùi Thanh Thảo",
    role: "EMPLOYEE", roleTitle: "Nhân viên", department: "Phòng Nhân sự & Tuân thủ",
    status: "CONFIRMED", avatar: "BT",
    balance: { annual: 7, annualTotal: 12, sick: 30, maternity: 26, unpaid: 0 },
    salt: "e013ab7f9b7bdb768b0779edb6237749",
    passwordHash: "54343b657f3e4959b1715d7d6fff3f27a0dd4cd387a1769344bc320e29cbde3737882aaaa01665fc04c9120b6583ac6985760331328cdb56117866b74de1bd10",
  },
  {
    username: "quang.nguyen", employeeId: "QL-2024-0001", name: "Nguyễn Văn Quang",
    role: "MANAGER", roleTitle: "Trưởng phòng Kinh doanh", department: "Phòng Kinh doanh",
    status: "CONFIRMED", avatar: "NQ",
    balance: { annual: 10, annualTotal: 14, sick: 30, maternity: 0, unpaid: 0 },
    salt: "fe8369499896c98b7dbbcd56d939d049",
    passwordHash: "9e5867939e2e14379590c1f44f0c6a08303997a9927758aeecb9f71a8c0c939ef4b3229d4c29988568151073d888f73fab5d235d3fad7a0ab470f6214d3f4d47",
  },
  {
    username: "linh.tran", employeeId: "GD-2024-0001", name: "Trần Thị Linh",
    role: "DIRECTOR", roleTitle: "Giám đốc Ban Điều hành", department: "Ban Điều hành",
    status: "CONFIRMED", avatar: "TL",
    balance: { annual: 12, annualTotal: 16, sick: 30, maternity: 26, unpaid: 0 },
    salt: "97a0ad5f880460ffeca48dd0f528abf8",
    passwordHash: "9567fdad03fc0caeca0582d38592e11fdd8b09eb863a214830f2ced1065f17be9dcd027dbf9b341572344fd8bfb264112c717061eac6c5a2a2483f5d51487fb3",
  },
];

const PersistedAccountStateSchema = z.object({
  balances: z.record(z.string().regex(/^[a-f0-9]{64}$/), LeaveBalanceSchema),
  applied_request_ids: z.array(z.string().min(1)),
}).strict();

const ACCOUNT_STATE_PATH = process.env["AER_ACCOUNT_STATE_FILE"] ??
  resolve(process.cwd(), "data/leave-balances.json");
const appliedLeaveRequestIds = new Set<string>();

function hashEmployeeAccount(account: UserAccount): string {
  return createHash("sha256").update(account.employeeId).digest("hex");
}

function persistAccountState(): void {
  const state = {
    balances: Object.fromEntries(USER_ACCOUNTS.map((account) => [
      hashEmployeeAccount(account),
      toLeaveBalanceSnapshot(account),
    ])),
    applied_request_ids: [...appliedLeaveRequestIds],
  };
  const temporaryPath = `${ACCOUNT_STATE_PATH}.${process.pid}.tmp`;

  try {
    mkdirSync(dirname(ACCOUNT_STATE_PATH), { recursive: true });
    writeFileSync(temporaryPath, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporaryPath, ACCOUNT_STATE_PATH);
  } catch {
    throw new Error("[AER/accounts] Could not persist leave balance state.");
  }
}

function restoreAccountState(): void {
  let rawState: string;
  try {
    rawState = readFileSync(ACCOUNT_STATE_PATH, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    console.warn("[AER/accounts] Leave balance state could not be read; using seeded balances.");
    return;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawState);
  } catch {
    console.warn("[AER/accounts] Leave balance state is invalid; using seeded balances.");
    return;
  }

  const parsed = PersistedAccountStateSchema.safeParse(decoded);
  if (!parsed.success) {
    console.warn("[AER/accounts] Leave balance state failed validation; using seeded balances.");
    return;
  }

  for (const account of USER_ACCOUNTS) {
    const savedBalance = parsed.data.balances[hashEmployeeAccount(account)];
    if (!savedBalance) continue;
    account.balance.annual = savedBalance.annual_days_remaining;
    account.balance.sick = savedBalance.sick_days_remaining;
    account.balance.maternity = savedBalance.maternity_weeks_remaining;
    account.balance.unpaid = savedBalance.unpaid_days_used_ytd;
  }
  parsed.data.applied_request_ids.forEach((requestId) => appliedLeaveRequestIds.add(requestId));
}

restoreAccountState();

export type PublicAccount = Omit<UserAccount, "salt" | "passwordHash">;

export function toPublicAccount(account: UserAccount): PublicAccount {
  const { salt: _salt, passwordHash: _passwordHash, ...publicAccount } = account;
  return publicAccount;
}

export function findAccountByEmployeeHash(hashedEmployeeId: string): UserAccount | undefined {
  return USER_ACCOUNTS.find((account) => hashEmployeeAccount(account) === hashedEmployeeId);
}

export function toLeaveBalanceSnapshot(account: UserAccount): LeaveBalance {
  return {
    annual_days_remaining: account.balance.annual,
    sick_days_remaining: account.balance.sick,
    maternity_weeks_remaining: account.balance.maternity,
    unpaid_days_used_ytd: account.balance.unpaid,
  };
}

export type LeaveBalanceApplyResult =
  | "APPLIED"
  | "ALREADY_APPLIED"
  | "INSUFFICIENT"
  | "NOT_TRACKED";

/** Apply approved annual/sick leave once against a tracked employee account. */
export function applyApprovedLeaveBalance(
  account: UserAccount,
  requestId: string,
  leaveType: LeaveType,
  days: number
): LeaveBalanceApplyResult {
  if (appliedLeaveRequestIds.has(requestId)) return "ALREADY_APPLIED";

  const balanceKey = leaveType === "ANNUAL"
    ? "annual"
    : leaveType === "SICK"
      ? "sick"
      : null;
  if (!balanceKey) return "NOT_TRACKED";
  if (days > account.balance[balanceKey]) return "INSUFFICIENT";

  const previousBalance = account.balance[balanceKey];
  account.balance[balanceKey] -= days;
  appliedLeaveRequestIds.add(requestId);
  try {
    persistAccountState();
  } catch (error) {
    account.balance[balanceKey] = previousBalance;
    appliedLeaveRequestIds.delete(requestId);
    throw error;
  }
  return "APPLIED";
}
