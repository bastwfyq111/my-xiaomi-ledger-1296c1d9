import { create } from "zustand";
import { persist } from "zustand/middleware";
import seedTrainees from "@/data/trainees.json";
import seedInstallments from "@/data/installments.json";

// --- تعريف الأنواع (Types) ---

export type Trainee = { name: string; batch: string; specialty: string };

export const INSTALLMENT_MONTHS = [
  "يناير","فبراير","مارس","ابريل","مايو","يونيو",
  "يوليو","اغسطس","سبتمبر","اكتوبر","نوفمبر","ديسمبر",
] as const;

export type Installment = {
  no?: number | null;
  name: string;
  batch: string;
  specialty: string;
  fees: number;
  prevDue: number;
  payments: Record<string, number>;
  totalPaid: number;
  remaining: number;
  notes: string;
  phone: string;
};

export type Hafiza = {
  id: string;
  name: string;
  batch: string;
  specialty: string;
  date: string;
  hafizaNo: string;
  description: string;
  hafizaAmount: number;
  notifyDate?: string;
  notifyNo?: string;
  notifyAmount?: number;
};

export type Account = {
  id: string;
  date: string;
  hafizaNo: string;
  notifyNo: string;
  notifyDate: string;
  checkNo: string;
  checkDate: string;
  description: string;
  specialty: string;
  name: string;
  hafizaAmount: number;
  income: number;
  expense: number;
  sourceHafizaId?: string;
};

export type Journal = {
  id: string;
  date: string;
  formNo: string;
  settlement?: string;
  description: string;
  debit: number;
  credit: number;
  account: string;
  debitAccount?: string;
  creditAccount?: string;
  debitCol?: string;
  creditCol?: string;
};

export type RevenueMap = Record<string, number>;

export type CustomTab = {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

// --- واجهة المتجر كاملة ---
type State = {
  // البيانات
  trainees: Trainee[];
  hafiza: Hafiza[];
  accounts: Account[];
  journal: Journal[];
  installments: Installment[];
  installments2025: Installment[];
  openingBalance: number;
  revenue: RevenueMap;
  customTabs: CustomTab[];

  // --- عمليات المتدربين ---
  addTrainee: (t: Trainee) => void;
  updateTrainee: (index: number, t: Trainee) => void;
  deleteTrainee: (index: number) => void;
  importTrainees: (trainees: Trainee[]) => void;

  // --- عمليات الحافظة ---
  addHafiza: (h: Omit<Hafiza, "id">) => Hafiza;
  updateHafiza: (id: string, h: Partial<Hafiza>) => void;
  deleteHafiza: (id: string) => void;
  clearHafiza: () => void;

  // --- عمليات الحسابات ---
  addAccount: (a: Omit<Account, "id">) => Account;
  updateAccount: (id: string, a: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  clearAccounts: () => void;

  // --- عمليات اليومية ---
  addJournal: (j: Omit<Journal, "id">) => Journal;
  updateJournal: (id: string, j: Partial<Journal>) => void;
  deleteJournal: (id: string) => void;
  clearJournal: () => void;

  // --- عمليات الأقساط ---
  addInstallment: (i: Omit<Installment, "totalPaid" | "remaining">, year?: '2025') => void;
  updateInstallment: (index: number, i: Partial<Installment>, year?: '2025') => void;
  updateInstallmentPayment: (index: number, month: string, amount: number, year?: '2025') => void;
  deleteInstallment: (index: number, year?: '2025') => void;
  clearInstallments: (year?: '2025') => void;
  recalcAllInstallments: () => void;

  // --- الإعدادات العامة ---
  setOpeningBalance: (n: number) => void;
  setRevenue: (year: number, month: number, itemKey: string, amount: number) => void;

  // --- الاستيراد والتصدير ---
  importData: (d: any) => void;
  exportAllData: () => any;
  clearAll: () => void;
  clearTab: (tab: string) => void;

  // --- التبويبات المخصصة ---
  addCustomTab: (name: string) => CustomTab;
  renameCustomTab: (id: string, name: string) => void;
  deleteCustomTab: (id: string) => void;
  addCustomColumn: (id: string, col: string) => void;
  removeCustomColumn: (id: string, col: string) => void;
  addCustomRow: (id: string, row: Record<string, string | number>) => void;
  updateCustomRow: (id: string, index: number, row: Record<string, string | number>) => void;
  deleteCustomRow: (id: string, index: number) => void;

  // --- دوال مساعدة ---
  getHafizaById: (id: string) => Hafiza | undefined;
  getAccountById: (id: string) => Account | undefined;
  getTotalIncome: () => number;
  getTotalExpenses: () => number;
  getOverdueInstallments: (year?: '2025') => Installment[];
  getInstallmentByIndex: (index: number, year?: '2025') => Installment | undefined;
};

// --- دوال مساعدة ---
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const getToday = () => new Date().toISOString().split('T')[0];

const recalcInstallment = (i: Installment): Installment => {
  const totalPaid = Object.values(i.payments || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fees = Number(i.fees) || 0;
  const prevDue = Number(i.prevDue) || 0;
  return { ...i, fees, prevDue, totalPaid, remaining: prevDue - totalPaid };
};

// --- إنشاء المتجر ---
export const useStore = create<State>()(
  persist(
    (set, get) => ({
      // --- القيم الابتدائية ---
      trainees: seedTrainees as Trainee[],
      hafiza: [],
      accounts: [],
      journal: [],
      installments: (seedInstallments as Installment[]).map(recalcInstallment),
      installments2025: [],
      openingBalance: 811664,
      revenue: {},
      customTabs: [],

      // ============ عمليات المتدربين ============
      addTrainee: (t) => set((s) => ({ trainees: [...s.trainees, t] })),

      updateTrainee: (index, t) =>
        set((s) => ({
          trainees: s.trainees.map((tr, i) => (i === index ? t : tr)),
        })),

      deleteTrainee: (index) =>
        set((s) => ({
          trainees: s.trainees.filter((_, i) => i !== index),
        })),

      importTrainees: (trainees) =>
        set((s) => ({ trainees: [...s.trainees, ...trainees] })),

      // ============ عمليات الحافظة ============
      addHafiza: (h) => {
        const item: Hafiza = {
          ...h,
          id: uid(),
          date: h.date || getToday(),
          hafizaAmount: Number(h.hafizaAmount) || 0,
          notifyAmount: Number(h.notifyAmount) || 0,
        };
        set((s) => ({ hafiza: [...s.hafiza, item] }));
        return item;
      },

      updateHafiza: (id, h) =>
        set((s) => ({
          hafiza: s.hafiza.map((x) => (x.id === id ? { ...x, ...h } : x)),
        })),

      deleteHafiza: (id) =>
        set((s) => ({
          hafiza: s.hafiza.filter((x) => x.id !== id),
          // حذف الحسابات المرتبطة
          accounts: s.accounts.filter((a) => a.sourceHafizaId !== id),
        })),

      clearHafiza: () => set({ hafiza: [] }),

      // ============ عمليات الحسابات ============
      addAccount: (a) => {
        const item: Account = {
          ...a,
          id: uid(),
          date: a.date || getToday(),
          hafizaAmount: Number(a.hafizaAmount) || 0,
          income: Number(a.income) || 0,
          expense: Number(a.expense) || 0,
        };
        set((s) => ({ accounts: [...s.accounts, item] }));
        return item;
      },

      updateAccount: (id, a) =>
        set((s) => ({
          accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...a } : x)),
        })),

      deleteAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((x) => x.id !== id),
        })),

      clearAccounts: () => set({ accounts: [] }),

      // ============ عمليات اليومية ============
      addJournal: (j) => {
        const item: Journal = {
          ...j,
          id: uid(),
          date: j.date || getToday(),
          debit: Number(j.debit) || 0,
          credit: Number(j.credit) || 0,
        };
        set((s) => ({ journal: [...s.journal, item] }));
        return item;
      },

      updateJournal: (id, j) =>
        set((s) => ({
          journal: s.journal.map((x) => (x.id === id ? { ...x, ...j } : x)),
        })),

      deleteJournal: (id) =>
        set((s) => ({
          journal: s.journal.filter((x) => x.id !== id),
        })),

      clearJournal: () => set({ journal: [] }),

      // ============ عمليات الأقساط ============
      addInstallment: (i, year) => {
        const newInst: Installment = recalcInstallment({
          ...i,
          payments: {},
          totalPaid: 0,
          remaining: Number(i.prevDue) || 0,
        } as Installment);
        
        set((s) => {
          const key = year === '2025' ? 'installments2025' : 'installments';
          return { [key]: [...s[key], newInst] };
        });
      },

      updateInstallment: (index, i, year) =>
        set((s) => {
          const key = year === '2025' ? 'installments2025' : 'installments';
          const updated = s[key].map((inst: Installment, idx: number) =>
            idx === index ? recalcInstallment({ ...inst, ...i }) : inst
          );
          return { [key]: updated };
        }),

      updateInstallmentPayment: (index, month, amount, year) =>
        set((s) => {
          const key = year === '2025' ? 'installments2025' : 'installments';
          const updated = s[key].map((inst: Installment, idx: number) =>
            idx === index
              ? recalcInstallment({
                  ...inst,
                  payments: { ...inst.payments, [month]: amount },
                })
              : inst
          );
          return { [key]: updated };
        }),

      deleteInstallment: (index, year) =>
        set((s) => {
          const key = year === '2025' ? 'installments2025' : 'installments';
          return { [key]: s[key].filter((_: any, i: number) => i !== index) };
        }),

      clearInstallments: (year) => {
        if (year === '2025') {
          set({ installments2025: [] });
        } else {
          set({ installments: [], installments2025: [] });
        }
      },

      recalcAllInstallments: () =>
        set((s) => ({
          installments: s.installments.map(recalcInstallment),
          installments2025: s.installments2025.map(recalcInstallment),
        })),

      // ============ الإعدادات العامة ============
      setOpeningBalance: (n) => set({ openingBalance: n }),

      setRevenue: (year, month, itemKey, amount) =>
        set((s) => ({
          revenue: { ...s.revenue, [`${year}-${month}-${itemKey}`]: amount },
        })),

      // ============ الاستيراد والتصدير ============
      importData: (d) =>
        set((s) => ({
          trainees: d.trainees
            ? [...s.trainees, ...d.trainees]
            : s.trainees,

          journal: d.journal
            ? [
                ...s.journal,
                ...d.journal.map((j: any) => ({
                  ...j,
                  id: j.id || uid(),
                  debit: Number(j.debit) || 0,
                  credit: Number(j.credit) || 0,
                })),
              ]
            : s.journal,

          hafiza: d.hafiza
            ? [
                ...s.hafiza,
                ...d.hafiza.map((h: any) => ({
                  ...h,
                  id: h.id || uid(),
                  hafizaAmount: Number(h.hafizaAmount) || 0,
                  notifyAmount: Number(h.notifyAmount) || 0,
                })),
              ]
            : s.hafiza,

          accounts: d.accounts
            ? [
                ...s.accounts,
                ...d.accounts.map((a: any) => ({
                  ...a,
                  id: a.id || uid(),
                  hafizaAmount: Number(a.hafizaAmount) || 0,
                  income: Number(a.income) || 0,
                  expense: Number(a.expense) || 0,
                })),
              ]
            : s.accounts,

          installments: d.installments
            ? [...s.installments, ...d.installments.map(recalcInstallment)]
            : s.installments,

          installments2025: d.installments2025
            ? [...s.installments2025, ...d.installments2025.map(recalcInstallment)]
            : s.installments2025,

          openingBalance: d.openingBalance ?? s.openingBalance,
          revenue: d.revenue ? { ...s.revenue, ...d.revenue } : s.revenue,
        })),

      exportAllData: () => {
        const state = get();
        return {
          trainees: state.trainees,
          hafiza: state.hafiza,
          accounts: state.accounts,
          journal: state.journal,
          installments: state.installments,
          installments2025: state.installments2025,
          openingBalance: state.openingBalance,
          revenue: state.revenue,
          customTabs: state.customTabs,
        };
      },

      clearAll: () =>
        set({
          hafiza: [],
          accounts: [],
          journal: [],
          installments: [],
          installments2025: [],
          revenue: {},
        }),

      clearTab: (tab) => set((s) => ({ ...s, [tab]: [] })),

      // ============ التبويبات المخصصة ============
      addCustomTab: (name) => {
        const tab: CustomTab = { id: uid(), name, columns: [], rows: [] };
        set((s) => ({ customTabs: [...s.customTabs, tab] }));
        return tab;
      },

      renameCustomTab: (id, name) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      deleteCustomTab: (id) =>
        set((s) => ({
          customTabs: s.customTabs.filter((t) => t.id !== id),
        })),

      addCustomColumn: (id, col) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id && !t.columns.includes(col)
              ? { ...t, columns: [...t.columns, col] }
              : t
          ),
        })),

      removeCustomColumn: (id, col) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id
              ? { ...t, columns: t.columns.filter((c) => c !== col) }
              : t
          ),
        })),

      addCustomRow: (id, row) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id ? { ...t, rows: [...t.rows, row] } : t
          ),
        })),

      updateCustomRow: (id, index, row) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id
              ? { ...t, rows: t.rows.map((r, i) => (i === index ? row : r)) }
              : t
          ),
        })),

      deleteCustomRow: (id, index) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id
              ? { ...t, rows: t.rows.filter((_, i) => i !== index) }
              : t
          ),
        })),

      // ============ دوال مساعدة ============
      getHafizaById: (id) => get().hafiza.find((h) => h.id === id),

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      getTotalIncome: () =>
        get().journal.reduce((sum, j) => sum + (j.credit || 0), 0),

      getTotalExpenses: () =>
        get().journal.reduce((sum, j) => sum + (j.debit || 0), 0),

      getOverdueInstallments: (year) => {
        const key = year === '2025' ? 'installments2025' : 'installments';
        const today = getToday();
        return get()[key].filter(
          (i: Installment) => i.remaining > 0
        );
      },

      getInstallmentByIndex: (index, year) => {
        const key = year === '2025' ? 'installments2025' : 'installments';
        return get()[key][index];
      },
    }),
    {
      name: "majlis-yemen-v1",
      version: 2,
    }
  )
);

// --- Selectors للاستخدام في المكونات ---
export const useTrainees = () => useStore((s) => s.trainees);
export const useHafiza = () => useStore((s) => s.hafiza);
export const useAccounts = () => useStore((s) => s.accounts);
export const useJournal = () => useStore((s) => s.journal);
export const useInstallments = () => useStore((s) => s.installments);
export const useInstallments2025 = () => useStore((s) => s.installments2025);
export const useCustomTabs = () => useStore((s) => s.customTabs);
export const useRevenue = () => useStore((s) => s.revenue);
export const useOpeningBalance = () => useStore((s) => s.openingBalance);
