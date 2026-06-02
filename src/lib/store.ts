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

type State = {
  trainees: Trainee[];
  hafiza: Hafiza[];
  accounts: Account[];
  journal: Journal[];
  installments: Installment[];
  installments2025: Installment[];
  openingBalance: number;
  revenue: RevenueMap;
  customTabs: CustomTab[];

  // العمليات
  addTrainee: (t: Trainee) => void;
  addHafiza: (h: Omit<Hafiza, "id">) => Hafiza;
  addAccount: (a: Omit<Account, "id">) => Account;
  addJournal: (j: Omit<Journal, "id">) => Journal;

  updateHafiza: (id: string, h: Partial<Hafiza>) => void;
  updateAccount: (id: string, a: Partial<Account>) => void;
  updateJournal: (id: string, j: Partial<Journal>) => void;

  deleteHafiza: (id: string) => void;
  deleteAccount: (id: string) => void;
  deleteJournal: (id: string) => void;

  setOpeningBalance: (n: number) => void;
  importData: (d: any) => void;
  clearAll: () => void;
  clearTab: (tab: string) => void;
  setRevenue: (year: number, month: number, itemKey: string, amount: number) => void;

  // Custom tabs
  addCustomTab: (name: string) => CustomTab;
  renameCustomTab: (id: string, name: string) => void;
  deleteCustomTab: (id: string) => void;
  addCustomColumn: (id: string, col: string) => void;
  removeCustomColumn: (id: string, col: string) => void;
  addCustomRow: (id: string, row: Record<string, string | number>) => void;
  updateCustomRow: (id: string, index: number, row: Record<string, string | number>) => void;
  deleteCustomRow: (id: string, index: number) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const recalcInstallment = (i: Installment): Installment => {
  const totalPaid = Object.values(i.payments || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fees = Number(i.fees) || 0;
  const prevDue = Number(i.prevDue) || 0;
  return { ...i, fees, prevDue, totalPaid, remaining: prevDue - totalPaid };
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      trainees: seedTrainees as Trainee[],
      hafiza: [],
      accounts: [],
      journal: [],
      installments: (seedInstallments as Installment[]).map(recalcInstallment),
      installments2025: [],
      openingBalance: 811664,
      revenue: {},
      customTabs: [],

      setRevenue: (year, month, itemKey, amount) =>
        set((s) => ({ revenue: { ...s.revenue, [`${year}-${month}-${itemKey}`]: amount } })),

      addTrainee: (t) => set((s) => ({ trainees: [...s.trainees, t] })),

      addHafiza: (h) => {
        const item = { ...h, id: uid(), hafizaAmount: Number(h.hafizaAmount) || 0 };
        set((s) => ({ hafiza: [...s.hafiza, item] }));
        return item;
      },

      addAccount: (a) => {
        const item = { ...a, id: uid(), hafizaAmount: Number(a.hafizaAmount) || 0, income: Number(a.income) || 0, expense: Number(a.expense) || 0 };
        set((s) => ({ accounts: [...s.accounts, item] }));
        return item;
      },

      addJournal: (j) => {
        const item = {
          ...j,
          id: uid(),
          debit: Number(j.debit) || 0,
          credit: Number(j.credit) || 0,
        };
        set((s) => ({ journal: [...s.journal, item] }));
        return item;
      },

      updateHafiza: (id, h) => set((s) => ({ hafiza: s.hafiza.map((x) => (x.id === id ? { ...x, ...h } : x)) })),
      updateAccount: (id, a) => set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...a } : x)) })),
      updateJournal: (id, j) => set((s) => ({ journal: s.journal.map((x) => (x.id === id ? { ...x, ...j } : x)) })),

      deleteHafiza: (id) => set((s) => ({ hafiza: s.hafiza.filter((x) => x.id !== id) })),
      deleteAccount: (id) => set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })),
      deleteJournal: (id) => set((s) => ({ journal: s.journal.filter((x) => x.id !== id) })),

      setOpeningBalance: (n) => set({ openingBalance: n }),

      // دالة الاستيراد الشاملة والمحدثة
      importData: (d) => set((s) => ({
        journal: d.journal ? [...s.journal, ...d.journal.map((j: any) => ({
          ...j,
          id: j.id || uid(),
          debit: Number(j.debit) || 0,
          credit: Number(j.credit) || 0,
        }))] : s.journal,
        
        hafiza: d.hafiza ? [...s.hafiza, ...d.hafiza.map((h: any) => ({
          ...h,
          id: h.id || uid(),
          hafizaAmount: Number(h.hafizaAmount) || 0,
          notifyAmount: Number(h.notifyAmount) || 0,
        }))] : s.hafiza,

        accounts: d.accounts ? [...s.accounts, ...d.accounts.map((a: any) => ({
          ...a,
          id: a.id || uid(),
          hafizaAmount: Number(a.hafizaAmount) || 0,
          income: Number(a.income) || 0,
          expense: Number(a.expense) || 0,
        }))] : s.accounts,

        installments: d.installments ? d.installments.map(recalcInstallment) : s.installments,
        installments2025: d.installments2025 ? d.installments2025.map(recalcInstallment) : s.installments2025,
      })),

      clearAll: () => set({ hafiza: [], accounts: [], journal: [] }),
      clearTab: (tab) => set((s) => ({ ...s, [tab]: [] })),

      // دوال Custom tabs
      addCustomTab: (name) => {
        const tab: CustomTab = { id: uid(), name, columns: [], rows: [] };
        set((s) => ({ customTabs: [...s.customTabs, tab] }));
        return tab;
      },
      renameCustomTab: (id, name) =>
        set((s) => ({ customTabs: s.customTabs.map((t) => (t.id === id ? { ...t, name } : t)) })),
      deleteCustomTab: (id) =>
        set((s) => ({ customTabs: s.customTabs.filter((t) => t.id !== id) })),
      addCustomColumn: (id, col) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id && !t.columns.includes(col) ? { ...t, columns: [...t.columns, col] } : t
          ),
        })),
      removeCustomColumn: (id, col) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id ? { ...t, columns: t.columns.filter((c) => c !== col) } : t
          ),
        })),
      addCustomRow: (id, row) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) => (t.id === id ? { ...t, rows: [...t.rows, row] } : t)),
        })),
      updateCustomRow: (id, index, row) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id ? { ...t, rows: t.rows.map((r, i) => (i === index ? row : r)) } : t
          ),
        })),
      deleteCustomRow: (id, index) =>
        set((s) => ({
          customTabs: s.customTabs.map((t) =>
            t.id === id ? { ...t, rows: t.rows.filter((_, i) => i !== index) } : t
          ),
        })),
    }),
    { name: "majlis-yemen-v1" }
  )
);
