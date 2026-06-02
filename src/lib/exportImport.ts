import * as XLSX from "xlsx";
import type { Account, Hafiza, Installment, Journal } from "./store";
import { INSTALLMENT_MONTHS } from "./store";
import monthlySchema from "@/data/monthlyStatement.json";
import {
  TEMPLATE,
  DEBIT_FIRST, DEBIT_LAST, CREDIT_FIRST, CREDIT_LAST,
  DEBIT_TOTAL_COL, CREDIT_TOTAL_COL,
  colLetterToIndex, findColByName,
} from "./journalTemplate";

const JOURNAL_SHEET_NAME = "المجلس الطبي يومية";

function buildJournalSheet(journal: Journal[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  for (const [letter, val] of Object.entries(TEMPLATE.top1)) {
    ws[`${letter}1`] = { v: val, t: typeof val === "number" ? "n" : "s" };
  }
  for (const [letter, val] of Object.entries(TEMPLATE.top2)) {
    ws[`${letter}2`] = { v: val, t: typeof val === "number" ? "n" : "s" };
  }
  for (const c of TEMPLATE.cols) {
    if (c.section != null) ws[`${c.col}3`] = { v: c.section, t: "s" };
    if (c.name != null) ws[`${c.col}4`] = { v: c.name, t: "s" };
  }

  const monthsArabic = ["يناير","فبراير","مارس","ابريل","مايو","يونيو","يوليو","اغسطس","سبتمبر","اكتوبر","نوفمبر","ديسمبر"];
  const sorted = [...journal].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const grouped = new Map<string, Journal[]>();
  for (const j of sorted) {
    const key = (j.date || "0000-00").slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(j);
  }

  let row = 5;
  const merges: XLSX.Range[] = TEMPLATE.merges.map((m) => XLSX.utils.decode_range(m));

  const firstDebitColLetter = XLSX.utils.encode_col(DEBIT_FIRST - 1);
  const lastDebitColLetter = XLSX.utils.encode_col(DEBIT_LAST - 1);
  const firstCreditColLetter = XLSX.utils.encode_col(CREDIT_FIRST - 1);
  const lastCreditColLetter = XLSX.utils.encode_col(CREDIT_LAST - 1);

  let serial = 0;
  for (const [ymKey, items] of grouped) {
    let label = ymKey;
    const parts = ymKey.split("-");
    if (parts.length === 2) {
      const m = parseInt(parts[1], 10);
      const y = parts[0];
      if (m >= 1 && m <= 12) label = `${monthsArabic[m - 1]}  ${y}`;
    }
    ws[`A${row}`] = { v: label, t: "s" };
    merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 3 } });
    row++;

    for (const j of items) {
      serial++;
      ws[`A${row}`] = { v: serial, t: "n" };
      if (j.formNo) ws[`B${row}`] = { v: j.formNo, t: "s" };
      if (j.date) ws[`C${row}`] = { v: j.date, t: "s" };
      if (j.description) ws[`D${row}`] = { v: j.description, t: "s" };

      const debitCol = j.debitCol || (j.debitAccount ? findColByName(j.debitAccount, "debit") : null);
      const creditCol = j.creditCol || (j.creditAccount ? findColByName(j.creditAccount, "credit") : null);
      if (debitCol && j.debit) ws[`${debitCol}${row}`] = { v: j.debit, t: "n" };
      if (creditCol && j.credit) ws[`${creditCol}${row}`] = { v: j.credit, t: "n" };

      ws[`${DEBIT_TOTAL_COL}${row}`] = {
        f: `SUM(${firstDebitColLetter}${row}:${lastDebitColLetter}${row})`,
        v: j.debit || 0, t: "n",
      };
      ws[`${CREDIT_TOTAL_COL}${row}`] = {
        f: `SUM(${firstCreditColLetter}${row}:${lastCreditColLetter}${row})`,
        v: j.credit || 0, t: "n",
      };
      row++;
    }
  }

  const lastCol = 101;
  const lastRow = Math.max(row - 1, 5);
  ws["!ref"] = `A1:${XLSX.utils.encode_col(lastCol - 1)}${lastRow}`;

  const cols: XLSX.ColInfo[] = [];
  for (let i = 1; i <= lastCol; i++) {
    const letter = XLSX.utils.encode_col(i - 1);
    const w = TEMPLATE.widths[letter];
    cols.push({ wch: w || 12 });
  }
  ws["!cols"] = cols;
  ws["!merges"] = merges;
  return ws;
}


export function exportToExcel(data: { hafiza: Hafiza[]; accounts: Account[]; journal: Journal[]; installments?: Installment[]; openingBalance: number }) {
  const wb = XLSX.utils.book_new();

  const hafizaRows = data.hafiza.map((h, i) => ({
    "م": i + 1,
    "الاسم": h.name,
    "الدفعة": h.batch,
    "التخصص": h.specialty,
    "التاريخ": h.date,
    "رقم الحافظة": h.hafizaNo,
    "البيان": h.description,
    "مبلغ الحافظة": h.hafizaAmount,
    "تاريخ التوريد": h.notifyDate || "",
    "رقم الاشعار": h.notifyNo || "",
    "مبلغ التوريد": h.notifyAmount || "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hafizaRows), "الحوافظ");

  let bal = data.openingBalance;
  const accRows: Record<string, string | number>[] = [
    { "م": 1, "البيان": "رصيد افتتاحي", "الإيرادات": data.openingBalance, "الرصيد": data.openingBalance },
  ];
  data.accounts.forEach((a, i) => {
    bal = bal + (a.income || 0) - (a.expense || 0);
    accRows.push({
      "م": i + 2,
      "التاريخ": a.date,
      "رقم الحافظة": a.hafizaNo,
      "رقم الاشعار": a.notifyNo,
      "تاريخ التوريد": a.notifyDate,
      "رقم الشيك": a.checkNo,
      "تاريخه": a.checkDate,
      "البيان": a.description,
      "التخصص": a.specialty,
      "الاسم": a.name,
      "مبلغ الحافظة": a.hafizaAmount,
      "الإيرادات": a.income || 0,
      "المصروفات": a.expense || 0,
      "الرصيد": bal,
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accRows), "الحساب");

  XLSX.utils.book_append_sheet(wb, buildJournalSheet(data.journal), JOURNAL_SHEET_NAME);

  if (data.installments && data.installments.length) {
    const instRows = data.installments.map((i, idx) => {
      const row: Record<string, string | number> = {
        "م": idx + 1,
        "الاسم": i.name,
        "الدفعة": i.batch,
        "التخصص": i.specialty,
        "رسوم الدراسة": i.fees,
        "المتبقي من 2025": i.prevDue,
      };
      INSTALLMENT_MONTHS.forEach((m) => (row[m] = i.payments[m] || 0));
      row["إجمالي المدفوع"] = i.totalPaid;
      row["المتبقي"] = i.remaining;
      row["الملاحظات"] = i.notes;
      row["الجوال"] = i.phone;
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instRows), "الأقساط");
  }

  XLSX.writeFile(wb, `قيود_اليومية_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export type ImportKind = "hafiza" | "account" | "journal" | "installments" | "revenue" | "monthly";

// Aggressive Arabic normalization for header/key matching
export const normHeader = (s: unknown): string => {
  const str = String(s ?? "");
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/[\u0649\u064A]/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[()\[\]./\\،,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export async function importFromExcel(file: File, only?: ImportKind) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const result: { hafiza: Hafiza[]; accounts: Account[]; journal: Journal[]; installments: Installment[]; revenue: Record<string, number> } = {
    hafiza: [],
    accounts: [],
    journal: [],
    installments: [],
    revenue: {},
  };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const toDate = (v: unknown): string => {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    return String(v);
  };
  const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v) || 0);
  const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
  // Convert raw cell to a clean string (strip trailing .0 from numbers)
  const cellStr = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (typeof v === "number") {
      return Number.isInteger(v) ? String(v) : String(v);
    }
    return String(v).trim();
  };

  // التعرف على نوع الورقة من اسم الورقة أو عناوين الأعمدة
  const detectKind = (sheetName: string, cols: string[]): ImportKind | null => {
    const n = sheetName;
    if (n.includes("ايراد") || n.includes("إيراد") || n.includes("موارد")) return "revenue";
    if (n.includes("كشف") || n.includes("حساب المدة") || n.includes("شهر يناير") || n.includes("شهر فبراير")) return "monthly";
    if (n.includes("قسط") || n.includes("الأقساط") || n.includes("الاقساط")) return "installments";
    if (n.includes("حافظ") || n.includes("حوافظ")) return "hafiza";
    if (n.includes("يومية") || n.includes("اليومية") || n.includes("قيود")) return "journal";
    if (n.includes("الحساب") || n.includes("حساب")) return "account";
    const has = (s: string) => cols.some((c) => c.includes(s));
    if (has("الحساب المدين") || (has("مدين") && has("دائن"))) return "journal";
    if (has("الإيرادات") || has("المصروفات") || has("الرصيد")) return "account";
    if (INSTALLMENT_MONTHS.some((m) => has(m))) return "installments";
    if (has("مبلغ التوريد") || has("رقم الحافظة")) return "hafiza";
    return null;
  };

  // البحث عن صف العناوين داخل الورقة (يتجاوز صفوف العنوان والدمج)
  const findHeaderRow = (aoa: unknown[][]): number => {
    const markers = [
      "الاسم", "البيان", "رقم الحافظة", "مبلغ الحافظة", "مدين", "دائن",
      "الإيرادات", "المصروفات", "رقم الاستمارة", "رسوم الدراسة",
    ];
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const row = (aoa[i] || []).map(norm);
      const hits = row.filter((c) => markers.some((m) => c.includes(m))).length;
      if (hits >= 2) return i;
    }
    return 0;
  };

  // تحويل ورقة إلى مصفوفة كائنات بالعناوين الفعلية
  const sheetToRows = (sheet: XLSX.WorkSheet): Record<string, unknown>[] => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    if (!aoa.length) return [];
    const headerIdx = findHeaderRow(aoa as unknown[][]);
    // Normalize headers aggressively so slight Arabic spelling/spacing
    // variants don't shift values to the wrong column.
    const headers = ((aoa[headerIdx] as unknown[]) || []).map(normHeader);
    const out: Record<string, unknown>[] = [];
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const row = aoa[i] as unknown[];
      if (!row || row.every((c) => c === "" || c == null)) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, j) => { if (h) obj[h] = row[j]; });
      out.push(obj);
    }
    return out;
  };

  // Helper: lookup row value by trying multiple Arabic header variants
  const get = (r: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[normHeader(k)];
      if (v !== undefined && v !== "") return v;
    }
    return "";
  };

  // Parse a revenue sheet exported by exportRevenueStatement.
  // Sheet name is "الايرادات شهر N" — we use it to derive month + year.
  const parseRevenueSheet = (sheet: XLSX.WorkSheet, sheetName: string): Record<string, number> | null => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    if (aoa.length < 6) return null;
    // Extract month from sheet name (e.g. "الايرادات شهر 3")
    const mMatch = sheetName.match(/(\d{1,2})/);
    if (!mMatch) return null;
    const month = parseInt(mMatch[1], 10);
    if (month < 1 || month > 12) return null;
    // Extract year from header row (row index 2): "...عام المالي 2026"
    let year = new Date().getFullYear();
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      for (const c of aoa[i] as unknown[]) {
        const yMatch = String(c ?? "").match(/(20\d{2})/);
        if (yMatch) { year = parseInt(yMatch[1], 10); break; }
      }
    }
    const out: Record<string, number> = {};
    let curCh = 0, curSec = 0, curIt = 0;
    // Data rows start at index 5 (row 6 in Excel)
    for (let i = 5; i < aoa.length; i++) {
      const row = aoa[i] as unknown[];
      if (!row) continue;
      // Columns: A=0 title, C=2 chapter#, D=3 section#, E=4 item#, F=5 type#, I=8 current amount
      const ch = num(row[2]), sec = num(row[3]), it = num(row[4]), tp = num(row[5]);
      const cur = num(row[8]);
      if (ch && !sec && !it && !tp) { curCh = ch; continue; }
      if (sec && !tp) { curSec = sec; if (it) curIt = it; continue; }
      if (it && !tp) { curIt = it; continue; }
      if (tp && curCh && curSec && curIt && cur) {
        out[`${year}-${month}-${curCh}-${curSec}-${curIt}-${tp}`] = cur;
      }
    }
    return out;
  };

  // Template-aware journal parser (the wide multi-column format)
  const parseJournalTemplate = (sheet: XLSX.WorkSheet): Journal[] | null => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    if (aoa.length < 5) return null;
    const row4 = (aoa[3] as unknown[]) || [];
    // detect: AZ (idx 51) header should be "المبلغ الكلي" or row3 contains "اليومية العامة"
    const az = norm(row4[51]);
    const isTemplate = az.includes("المبلغ الكلي") || norm((aoa[1] as unknown[])?.[5]).includes("اليومية العامة");
    if (!isTemplate) return null;
    const out: Journal[] = [];
    for (let i = 4; i < aoa.length; i++) {
      const row = aoa[i] as unknown[];
      if (!row || row.every((c) => c === "" || c == null)) continue;
      const desc = norm(row[3]);
      const date = row[2];
      // skip month-section rows (no date and no values)
      if (!date && !desc) continue;
      // find first non-zero in debit cols (5..50 zero-based = idx 5..50) and credit (52..99)
      let debitCol: string | null = null, debitAmt = 0;
      for (let c = DEBIT_FIRST - 1; c <= DEBIT_LAST - 1; c++) {
        const v = num(row[c]);
        if (v) { debitCol = XLSX.utils.encode_col(c); debitAmt = v; break; }
      }
      let creditCol: string | null = null, creditAmt = 0;
      for (let c = CREDIT_FIRST - 1; c <= CREDIT_LAST - 1; c++) {
        const v = num(row[c]);
        if (v) { creditCol = XLSX.utils.encode_col(c); creditAmt = v; break; }
      }
      if (!debitAmt && !creditAmt && !desc) continue;
      // resolve account name from row 4 of the same column
      const debitName = debitCol ? norm(row4[colLetterToIndex(debitCol) - 1]) : "";
      const creditName = creditCol ? norm(row4[colLetterToIndex(creditCol) - 1]) : "";
      out.push({
        id: uid(),
        date: toDate(date),
        formNo: row[1] != null ? String(row[1]) : "",
        settlement: "",
        description: desc,
        account: debitName,
        debitAccount: debitName,
        creditAccount: creditName,
        debitCol: debitCol || undefined,
        creditCol: creditCol || undefined,
        debit: debitAmt || num(row[51]),
        credit: creditAmt || num(row[100]),
      });
    }
    return out;
  };

  // Parse a monthly-statement sheet into journal entries so values
  // aggregate (إضافة / خصم) into the كشف الحساب الشهري tab.
  const monthIndexFromName = (name: string): number => {
    const n = normHeader(name);
    const map: Record<string, number> = {
      "يناير": 1, "فبراير": 2, "مارس": 3, "ابريل": 4, "أبريل": 4, "مايو": 5,
      "يونيو": 6, "يوليو": 7, "اغسطس": 8, "أغسطس": 8, "سبتمبر": 9,
      "اكتوبر": 10, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
    };
    for (const k of Object.keys(map)) if (n.includes(normHeader(k))) return map[k];
    return 0;
  };
  const knownMonthlyAccounts = new Set(
    (monthlySchema as { groups: { accounts: string[] }[] }).groups.flatMap((g) =>
      g.accounts.map((a) => normHeader(a))
    )
  );
  const parseMonthlySheet = (sheet: XLSX.WorkSheet, sheetName: string): Journal[] => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    if (aoa.length < 5) return [];
    let month = monthIndexFromName(sheetName);
    let year = new Date().getFullYear();
    for (let i = 0; i < Math.min(aoa.length, 6); i++) {
      const rowTxt = (aoa[i] as unknown[]).map((c) => String(c ?? "")).join(" ");
      if (!month) month = monthIndexFromName(rowTxt);
      const ym = rowTxt.match(/(20\d{2})/);
      if (ym) year = parseInt(ym[1], 10);
    }
    if (!month) return [];
    const lastDay = new Date(year, month, 0).getDate();
    const opsDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const openDate = `${year - 1}-12-31`;
    let headerIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const r = (aoa[i] as unknown[]).map((c) => String(c ?? ""));
      if (r.some((c) => c.includes("مدين")) && r.some((c) => c.includes("دائن"))) {
        headerIdx = i; break;
      }
    }
    if (headerIdx < 0) return [];
    const out: Journal[] = [];
    // استيراد الأرصدة الافتتاحية لشهر يناير فقط لتجنب الازدواجية
    const importOpening = month === 1;
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const row = aoa[i] as unknown[];
      if (!row) continue;
      const account = norm(row[0]);
      if (!account) continue;
      if (!knownMonthlyAccounts.has(normHeader(account))) continue;
      const openD = num(row[1]);
      const openC = num(row[2]);
      const opsD = num(row[3]);
      const opsC = num(row[4]);
      if (importOpening && openD) out.push({ id: uid(), date: openDate, formNo: "", settlement: "", description: "رصيد افتتاحي (استيراد كشف شهري)", account, debitAccount: account, creditAccount: "", debit: openD, credit: 0 });
      if (importOpening && openC) out.push({ id: uid(), date: openDate, formNo: "", settlement: "", description: "رصيد افتتاحي (استيراد كشف شهري)", account: "", debitAccount: "", creditAccount: account, debit: 0, credit: openC });
      if (opsD) out.push({ id: uid(), date: opsDate, formNo: "", settlement: "", description: `عمليات ${sheetName} (استيراد كشف شهري)`, account, debitAccount: account, creditAccount: "", debit: opsD, credit: 0 });
      if (opsC) out.push({ id: uid(), date: opsDate, formNo: "", settlement: "", description: `عمليات ${sheetName} (استيراد كشف شهري)`, account: "", debitAccount: "", creditAccount: account, debit: 0, credit: opsC });
    }
    return out;
  };

  for (const name of wb.SheetNames) {
    // أوراق كشف الحساب الشهري — استيراد كأقياد للتجميع في الكشف
    if ((!only || only === "monthly" || only === "journal") && monthIndexFromName(name)) {
      const mRows = parseMonthlySheet(wb.Sheets[name], name);
      if (mRows.length) { result.journal.push(...mRows); continue; }
    }

    // Revenue sheets (exported format) — handle first
    if ((!only || only === "revenue") && (name.includes("ايراد") || name.includes("إيراد") || name.includes("موارد"))) {
      const rev = parseRevenueSheet(wb.Sheets[name], name);
      if (rev) {
        Object.assign(result.revenue, rev);
        continue;
      }
    }

    // Try template-aware journal import first
    const tplRows = parseJournalTemplate(wb.Sheets[name]);
    if (tplRows && tplRows.length) {
      if (!only || only === "journal") result.journal.push(...tplRows);
      continue;
    }

    const rows = sheetToRows(wb.Sheets[name]);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const kind = detectKind(name, cols);
    if (!kind) continue;
    if (only && kind !== only) continue;
    // fallback لأوراق الكشف غير المتعرف عليها بالاسم
    if (kind === "monthly") continue;


    if (kind === "hafiza") {
      rows.forEach((r) => {
        const name = cellStr(get(r, "الاسم"));
        const hafizaNo = cellStr(get(r, "رقم الحافظة"));
        if (!name && !hafizaNo) return;
        result.hafiza.push({
          id: uid(),
          name,
          batch: cellStr(get(r, "الدفعة")),
          specialty: cellStr(get(r, "التخصص")),
          date: toDate(get(r, "التاريخ")),
          hafizaNo,
          description: cellStr(get(r, "البيان")),
          hafizaAmount: num(get(r, "مبلغ الحافظة")),
          notifyDate: toDate(get(r, "تاريخ التوريد")),
          notifyNo: cellStr(get(r, "رقم الاشعار")),
          notifyAmount: num(get(r, "مبلغ التوريد")),
        });
      });
    } else if (kind === "account") {
      rows.forEach((r) => {
        const description = cellStr(get(r, "البيان"));
        const name = cellStr(get(r, "الاسم"));
        if (!description && !name) return;
        if (description.includes("رصيد افتتاحي")) return;
        const hafizaAmount = num(get(r, "مبلغ الحافظة"));
        const income = num(get(r, "الإيرادات", "الايرادات"));
        const expense = num(get(r, "المصروفات"));
        // Guard: prevent amount values from leaking into hafizaNo column when
        // the source file has an unusual column order or merged headers.
        let hafizaNo = cellStr(get(r, "رقم الحافظة"));
        const hafizaNoNum = Number(hafizaNo);
        if (
          hafizaNo &&
          !isNaN(hafizaNoNum) &&
          hafizaNoNum > 10000 &&
          (hafizaNoNum === hafizaAmount || hafizaNoNum === income || hafizaNoNum === expense)
        ) {
          hafizaNo = "";
        }
        result.accounts.push({
          id: uid(),
          date: toDate(get(r, "التاريخ")),
          hafizaNo,
          notifyNo: cellStr(get(r, "رقم الاشعار")),
          notifyDate: toDate(get(r, "تاريخ التوريد")),
          checkNo: cellStr(get(r, "رقم الشيك")),
          checkDate: toDate(get(r, "تاريخه", "تاريخ الشيك")),
          description,
          specialty: cellStr(get(r, "التخصص")),
          name,
          hafizaAmount,
          income,
          expense,
        });
      });
    } else if (kind === "journal") {
      rows.forEach((r) => {
        const description = cellStr(get(r, "البيان"));
        if (!description) return;
        if (description.includes("الإجمالي")) return;
        const debitAcc = cellStr(get(r, "الحساب المدين", "الحساب"));
        const creditAcc = cellStr(get(r, "الحساب الدائن"));
        result.journal.push({
          id: uid(),
          date: toDate(get(r, "التاريخ")),
          formNo: cellStr(get(r, "رقم الاستمارة")),
          settlement: cellStr(get(r, "كشف التسوية")),
          description,
          account: debitAcc,
          debitAccount: debitAcc,
          creditAccount: creditAcc,
          debit: num(get(r, "مدين")),
          credit: num(get(r, "دائن")),
        });
      });
    } else if (kind === "installments") {
      rows.forEach((r) => {
        const name = cellStr(get(r, "الاسم"));
        if (!name) return;
        const payments: Record<string, number> = {};
        INSTALLMENT_MONTHS.forEach((m) => (payments[m] = num(get(r, m))));
        const fees = num(get(r, "رسوم الدراسة", "الرسوم", "رسوم"));
        const prevDue = num(get(r, "المتبقي من 2025", "المتبقي السابق", "عليه"));
        const totalPaid = Object.values(payments).reduce((s, v) => s + v, 0);
        result.installments.push({
          no: get(r, "م") ? Number(get(r, "م")) : null,
          name,
          batch: cellStr(get(r, "الدفعة")),
          specialty: cellStr(get(r, "التخصص")),
          fees,
          prevDue,
          payments,
          totalPaid,
          remaining: prevDue - totalPaid,
          notes: cellStr(get(r, "الملاحظات")),
          phone: cellStr(get(r, "الجوال")),
        });
      });
    }
  }
  return result;
}

const MONTHLY_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function normName(s: string) { return (s || "").replace(/\s+/g, " ").trim(); }

type StatementGroup = { title: string; accounts: string[] };
const STATEMENT_GROUPS = (monthlySchema as { groups: StatementGroup[] }).groups;
const STATEMENT_TITLE = (monthlySchema as { title: string }).title;
const STATEMENT_OFFICE = (monthlySchema as { office: string }).office;
const STATEMENT_GOV = (monthlySchema as { governorate: string }).governorate;

function buildMonthlySheet(journal: Journal[], year: number, month: number): XLSX.WorkSheet {
  // Aggregate
  const map: Record<string, { prevD: number; prevC: number; curD: number; curC: number }> = {};
  STATEMENT_GROUPS.forEach((g) => g.accounts.forEach((a) => (map[normName(a)] = { prevD: 0, prevC: 0, curD: 0, curC: 0 })));
  journal.forEach((j) => {
    const d = new Date(j.date);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    if (m > month) return;
    const isCurrent = m === month;
    const dKey = normName(j.debitAccount || j.account || "");
    const cKey = normName(j.creditAccount || "");
    if (dKey && map[dKey]) (isCurrent ? (map[dKey].curD += +j.debit || 0) : (map[dKey].prevD += +j.debit || 0));
    if (cKey && map[cKey]) (isCurrent ? (map[cKey].curC += +j.credit || 0) : (map[cKey].prevC += +j.credit || 0));
  });

  const rows: (string | number)[][] = [];
  rows.push([STATEMENT_TITLE, "", "", "", "", "", "", "", ""]);
  rows.push([`المحافظة: ${STATEMENT_GOV}`, "", `مكتب: ${STATEMENT_OFFICE}`, "", "", "", "", "", ""]);
  rows.push([`عن شهر ${MONTHLY_NAMES[month - 1]} ${year}م`, "", "", "", "", "", "", "", ""]);
  rows.push([
    "بيان أنواع الحسابات الوسيطة",
    `الرصيد في 1/1/${year} مدين`, `الرصيد في 1/1/${year} دائن`,
    `عمليات شهر ${MONTHLY_NAMES[month - 1]} مدين`, `عمليات شهر ${MONTHLY_NAMES[month - 1]} دائن`,
    "الجملة مدين", "الجملة دائن",
    `الرصيد في ${year}/${month} مدين`, `الرصيد في ${year}/${month} دائن`,
  ]);

  let GPD = 0, GPC = 0, GCD = 0, GCC = 0;
  STATEMENT_GROUPS.forEach((g) => {
    rows.push([g.title, "", "", "", "", "", "", "", ""]);
    let gPD = 0, gPC = 0, gCD = 0, gCC = 0;
    g.accounts.forEach((a) => {
      const r = map[normName(a)] || { prevD: 0, prevC: 0, curD: 0, curC: 0 };
      const totD = r.prevD + r.curD;
      const totC = r.prevC + r.curC;
      const balD = Math.max(0, totD - totC);
      const balC = Math.max(0, totC - totD);
      gPD += r.prevD; gPC += r.prevC; gCD += r.curD; gCC += r.curC;
      rows.push([a, r.prevD, r.prevC, r.curD, r.curC, totD, totC, balD, balC]);
    });
    GPD += gPD; GPC += gPC; GCD += gCD; GCC += gCC;
    rows.push(["جملة " + g.title, gPD, gPC, gCD, gCC, gPD + gCD, gPC + gCC,
      Math.max(0, gPD + gCD - gPC - gCC), Math.max(0, gPC + gCC - gPD - gCD)]);
  });
  rows.push(["الإجمالي العام", GPD, GPC, GCD, GCC, GPD + GCD, GPC + GCC,
    Math.max(0, GPD + GCD - GPC - GCC), Math.max(0, GPC + GCC - GPD - GCD)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ];
  return ws;
}

function buildQuarterlySheet(journal: Journal[], year: number, quarter: number): XLSX.WorkSheet {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const map: Record<string, { prevD: number; prevC: number; curD: number; curC: number }> = {};
  STATEMENT_GROUPS.forEach((g) => g.accounts.forEach((a) => (map[normName(a)] = { prevD: 0, prevC: 0, curD: 0, curC: 0 })));
  journal.forEach((j) => {
    const d = new Date(j.date);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    if (m > endMonth) return;
    const isCurrent = m >= startMonth && m <= endMonth;
    const dKey = normName(j.debitAccount || j.account || "");
    const cKey = normName(j.creditAccount || "");
    if (dKey && map[dKey]) (isCurrent ? (map[dKey].curD += +j.debit || 0) : (map[dKey].prevD += +j.debit || 0));
    if (cKey && map[cKey]) (isCurrent ? (map[cKey].curC += +j.credit || 0) : (map[cKey].prevC += +j.credit || 0));
  });

  const qNames = ["الأول","الثاني","الثالث","الرابع"];
  const periodLabel = `الربع ${qNames[quarter - 1]} (${MONTHLY_NAMES[startMonth - 1]} - ${MONTHLY_NAMES[endMonth - 1]}) ${year}م`;
  const lastDay = new Date(year, endMonth, 0).getDate();

  const rows: (string | number)[][] = [];
  rows.push([STATEMENT_TITLE, "", "", "", "", "", "", "", ""]);
  rows.push([`المحافظة: ${STATEMENT_GOV}`, "", `مكتب: ${STATEMENT_OFFICE}`, "", "", "", "", "", ""]);
  rows.push([`حساب المدة - ${periodLabel}`, "", "", "", "", "", "", "", ""]);
  rows.push([
    "بيان أنواع الحسابات الوسيطة",
    `الرصيد في ${year}/${startMonth}/1 مدين`, `الرصيد في ${year}/${startMonth}/1 دائن`,
    `حساب المدة الربع ${qNames[quarter - 1]} مدين`, `حساب المدة الربع ${qNames[quarter - 1]} دائن`,
    "الجملة مدين", "الجملة دائن",
    `الرصيد في ${year}/${endMonth}/${lastDay} مدين`, `الرصيد في ${year}/${endMonth}/${lastDay} دائن`,
  ]);

  let GPD = 0, GPC = 0, GCD = 0, GCC = 0;
  STATEMENT_GROUPS.forEach((g) => {
    rows.push([g.title, "", "", "", "", "", "", "", ""]);
    let gPD = 0, gPC = 0, gCD = 0, gCC = 0;
    g.accounts.forEach((a) => {
      const r = map[normName(a)] || { prevD: 0, prevC: 0, curD: 0, curC: 0 };
      const totD = r.prevD + r.curD;
      const totC = r.prevC + r.curC;
      const balD = Math.max(0, totD - totC);
      const balC = Math.max(0, totC - totD);
      gPD += r.prevD; gPC += r.prevC; gCD += r.curD; gCC += r.curC;
      rows.push([a, r.prevD, r.prevC, r.curD, r.curC, totD, totC, balD, balC]);
    });
    GPD += gPD; GPC += gPC; GCD += gCD; GCC += gCC;
    rows.push(["جملة " + g.title, gPD, gPC, gCD, gCC, gPD + gCD, gPC + gCC,
      Math.max(0, gPD + gCD - gPC - gCC), Math.max(0, gPC + gCC - gPD - gCD)]);
  });
  rows.push(["الإجمالي العام", GPD, GPC, GCD, GCC, GPD + GCD, GPC + GCC,
    Math.max(0, GPD + GCD - GPC - GCC), Math.max(0, GPC + GCC - GPD - GCD)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ];
  return ws;
}

export function exportMonthlyStatement(journal: Journal[], year: number) {
  const wb = XLSX.utils.book_new();
  for (let m = 1; m <= 12; m++) {
    XLSX.utils.book_append_sheet(wb, buildMonthlySheet(journal, year, m), `شهر ${MONTHLY_NAMES[m - 1]}`);
  }
  const qNames = ["الأول","الثاني","الثالث","الرابع"];
  for (let q = 1; q <= 4; q++) {
    XLSX.utils.book_append_sheet(wb, buildQuarterlySheet(journal, year, q), `حساب المدة - ${qNames[q - 1]}`);
  }
  XLSX.writeFile(wb, `كشف_الحساب_الشهري_${year}.xlsx`);
}

// Build aggregated rows for PDF export (current view: month or quarter)
export function buildMonthlyStatementRows(
  journal: Journal[], year: number, startMonth: number, endMonth: number,
) {
  const map: Record<string, { prevD: number; prevC: number; curD: number; curC: number }> = {};
  STATEMENT_GROUPS.forEach((g) => g.accounts.forEach((a) => (map[normName(a)] = { prevD: 0, prevC: 0, curD: 0, curC: 0 })));
  journal.forEach((j) => {
    const d = new Date(j.date);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    if (m > endMonth) return;
    const isCurrent = m >= startMonth && m <= endMonth;
    const dKey = normName(j.debitAccount || j.account || "");
    const cKey = normName(j.creditAccount || "");
    if (dKey && map[dKey]) (isCurrent ? (map[dKey].curD += +j.debit || 0) : (map[dKey].prevD += +j.debit || 0));
    if (cKey && map[cKey]) (isCurrent ? (map[cKey].curC += +j.credit || 0) : (map[cKey].prevC += +j.credit || 0));
  });
  return { map, groups: STATEMENT_GROUPS, title: STATEMENT_TITLE, office: STATEMENT_OFFICE, gov: STATEMENT_GOV };
}


// ===== Revenue Statement Export =====
import revenueSchema from "@/data/revenueTemplate.json";

type RevType = { no: number; title: string };
type RevItem = { no: number; title: string; types: RevType[] };
type RevSection = { no: number; title: string; items: RevItem[] };
type RevChapter = { no: number; title: string; longTitle?: string; sections: RevSection[] };
const REV = revenueSchema as { title: string; office: string; chapters: RevChapter[] };

function buildRevenueSheet(revenue: Record<string, number>, year: number, month: number): XLSX.WorkSheet {
  const get = (m: number, key: string) => revenue[`${year}-${m}-${key}`] || 0;
  const sumPrev = (key: string) => { let s = 0; for (let m = 1; m < month; m++) s += get(m, key); return s; };

  // Pre-aggregate
  const types: Record<string, { cur: number; prev: number }> = {};
  const itemsAgg: Record<string, { cur: number; prev: number }> = {};
  const sectionsAgg: Record<string, { cur: number; prev: number }> = {};
  const chaptersAgg: Record<string, { cur: number; prev: number }> = {};
  let grandCur = 0, grandPrev = 0;
  REV.chapters.forEach((ch) => {
    let cCur = 0, cPrev = 0;
    ch.sections.forEach((sec) => {
      let sCur = 0, sPrev = 0;
      sec.items.forEach((it) => {
        let iCur = 0, iPrev = 0;
        it.types.forEach((t) => {
          const k = `${ch.no}-${sec.no}-${it.no}-${t.no}`;
          const cur = get(month, k), prev = sumPrev(k);
          types[k] = { cur, prev };
          iCur += cur; iPrev += prev;
        });
        itemsAgg[`${ch.no}-${sec.no}-${it.no}`] = { cur: iCur, prev: iPrev };
        sCur += iCur; sPrev += iPrev;
      });
      sectionsAgg[`${ch.no}-${sec.no}`] = { cur: sCur, prev: sPrev };
      cCur += sCur; cPrev += sPrev;
    });
    chaptersAgg[`${ch.no}`] = { cur: cCur, prev: cPrev };
    grandCur += cCur; grandPrev += cPrev;
  });

  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  // Top header (rows 1-3)
  ws["I2"] = { v: "كشف الحساب الشهري للموارد", t: "s" };
  merges.push(XLSX.utils.decode_range("E2:F2"));
  ws["B3"] = { v: "المجلس اليمني للاختصاصات الطبية", t: "s" };
  merges.push(XLSX.utils.decode_range("B3:F3"));
  ws["H3"] = { v: `${year}  عن شهر ${MONTHLY_NAMES[month - 1]} من العام المالي`, t: "s" };
  merges.push(XLSX.utils.decode_range("H3:L3"));

  // Column headers (rows 4-5)
  ws["A4"] = { v: "بيان مفردات الموارد", t: "s" };
  merges.push(XLSX.utils.decode_range("A4:B5"));
  ["C4","D4","E4","F4"].forEach((c, i) => {
    ws[c] = { v: ["الباب","الفصل","البند","النوع"][i], t: "s" };
    merges.push(XLSX.utils.decode_range(`${c}:${c[0]}5`));
  });
  ws["H4"] = { v: "الشهر الجاري", t: "s" }; merges.push(XLSX.utils.decode_range("H4:I4"));
  ws["J4"] = { v: "الأشهر السابقة", t: "s" }; merges.push(XLSX.utils.decode_range("J4:K4"));
  ws["L4"] = { v: "الجملة", t: "s" }; merges.push(XLSX.utils.decode_range("L4:M4"));
  ws["H5"] = { v: "ف", t: "s" }; ws["I5"] = { v: "ريال", t: "s" };
  ws["J5"] = { v: "ف", t: "s" }; ws["K5"] = { v: "ريال", t: "s" };
  ws["L5"] = { v: "ف", t: "s" }; ws["M5"] = { v: "ريال", t: "s" };

  let row = 6;
  const num = (r: number, col: string, v: number) => { if (v) ws[`${col}${r}`] = { v, t: "n" }; };
  const sumRow = (r: number, col: string, cur: number, prev: number, total = true) => {
    num(r, "I", cur); num(r, "K", prev); if (total) ws[`M${r}`] = { f: `I${r}+K${r}`, v: cur + prev, t: "n" };
  };

  // Grand total row at top
  ws[`A${row}`] = { v: "إجمالي الموارد", t: "s" };
  merges.push(XLSX.utils.decode_range(`A${row}:B${row}`));
  sumRow(row, "I", grandCur, grandPrev);
  row++;

  REV.chapters.forEach((ch) => {
    if (ch.sections.length === 0) return;
    ws[`A${row}`] = { v: ch.longTitle || ch.title, t: "s" };
    merges.push(XLSX.utils.decode_range(`A${row}:B${row}`));
    ws[`C${row}`] = { v: ch.no, t: "n" };
    sumRow(row, "I", chaptersAgg[ch.no].cur, chaptersAgg[ch.no].prev);
    row++;
    ch.sections.forEach((sec) => {
      ws[`A${row}`] = { v: sec.title, t: "s" };
      merges.push(XLSX.utils.decode_range(`A${row}:B${row}`));
      ws[`D${row}`] = { v: sec.no, t: "n" };
      sumRow(row, "I", sectionsAgg[`${ch.no}-${sec.no}`].cur, sectionsAgg[`${ch.no}-${sec.no}`].prev);
      row++;
      sec.items.forEach((it) => {
        ws[`A${row}`] = { v: it.title, t: "s" };
        merges.push(XLSX.utils.decode_range(`A${row}:B${row}`));
        ws[`E${row}`] = { v: it.no, t: "n" };
        sumRow(row, "I", itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur, itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev);
        row++;
        it.types.forEach((t) => {
          const k = `${ch.no}-${sec.no}-${it.no}-${t.no}`;
          const v = types[k];
          ws[`A${row}`] = { v: t.title, t: "s" };
          merges.push(XLSX.utils.decode_range(`A${row}:B${row}`));
          ws[`F${row}`] = { v: t.no, t: "n" };
          sumRow(row, "I", v.cur, v.prev);
          row++;
        });
      });
    });
  });

  // Chapter subtotals (all 5)
  const order = ["اﻷول","الثاني","الثالث","الرابع","الخامس"];
  REV.chapters.forEach((ch) => {
    const agg = chaptersAgg[ch.no] || { cur: 0, prev: 0 };
    ws[`A${row}`] = { v: `جملة الباب ${order[ch.no - 1]} : ${ch.title}`, t: "s" };
    merges.push(XLSX.utils.decode_range(`A${row}:F${row}`));
    sumRow(row, "I", agg.cur, agg.prev);
    row++;
  });

  // Final grand total
  ws[`A${row}`] = { v: "اجمالي عام الموارد", t: "s" };
  merges.push(XLSX.utils.decode_range(`A${row}:F${row}`));
  sumRow(row, "I", grandCur, grandPrev);

  ws["!ref"] = `A1:M${row}`;
  ws["!cols"] = [
    { wch: 13 }, { wch: 35 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 },
    { wch: 2 }, { wch: 4 }, { wch: 16 }, { wch: 4 }, { wch: 16 }, { wch: 4 }, { wch: 16 },
  ];
  ws["!merges"] = merges;
  return ws;
}

export function exportRevenueStatement(revenue: Record<string, number>, year: number) {
  const wb = XLSX.utils.book_new();
  for (let m = 1; m <= 12; m++) {
    XLSX.utils.book_append_sheet(wb, buildRevenueSheet(revenue, year, m), `الايرادات شهر ${m}`);
  }
  XLSX.writeFile(wb, `كشف_الايرادات_${year}.xlsx`);
}
