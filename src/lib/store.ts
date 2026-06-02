import { create } from "zustand";
import { persist } from "zustand/middleware";
import seedTrainees from "@/data/trainees.json";
import seedInstallments from "@/data/installments.json";

// --- تعريف الأنواع (Types) ---

export type Trainee = { name: string; batch: string; specialty: string };

export type Installment = {
  no: number | null;
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
  settlement: string;
  description: string;
  debit: number;
  credit: number;
  account: string;
};

export type RevenueMap = Record<string, number>;

type State = {
  trainees: Trainee[];
  hafiza: Hafiza[];
  accounts: Account[];
  journal: Journal[];
  installments: Installment[];
  openingBalance: number;
  revenue: RevenueMap;
  
  // العمليات
  addTrainee: (t: Trainee) => void;
  addHafiza: (h: Omit<Hafiza, "id">) => Hafiza;
  addAccount: (a: Omit<Account, "id">) => Account;
  addJournal: (j: Omit<Journal, "id">) => Journal; // تم تصحيح النوع هنا
  
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
      openingBalance: 811664,
      revenue: {},

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
            credit: Number(j.credit) || 0 
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
      
      importData: (d) => set((s) => ({
        journal: d.journal ? [...s.journal, ...d.journal.map((j: any) => ({ 
            ...j, 
            id: j.id || uid(),
            debit: Number(j.debit) || 0,
            credit: Number(j.credit) || 0
        }))] : s.journal,
      })),

      clearAll: () => set({ hafiza: [], accounts: [], journal: [] }),
      clearTab: (tab) => set((s) => ({ ...s, [tab]: [] })),
    }),
    { name: "majlis-yemen-v1" }
  )
);
