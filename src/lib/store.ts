import { create } from "zustand";
import { persist } from "zustand/middleware";
import seedTrainees from "@/data/trainees.json";
import seedInstallments from "@/data/installments.json";

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

export const INSTALLMENT_MONTHS = [
  "يناير","فبراير","مارس","ابريل","مايو","يونيو",
  "يوليو","اغسطس","سبتمبر","اكتوبر","نوفمبر","ديسمبر",
] as const;

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
  openingBalance: number;
  revenue: RevenueMap;
  customTabs: CustomTab[];
  addTrainee: (t: Trainee) => void;
  addHafiza: (h: Omit<Hafiza, "id">) => Hafiza;
  addAccount: (a: Omit<Account, "id">) => Account;
  addJournal: (j: Omit<Journal, "id text">) => Journal;
  updateHafiza: (id: string, h: Partial<Hafiza>) => void;
  updateAccount: (id: string, a: Partial<Account>) => void;
  updateJournal: (id: string, j: Partial<Journal>) => void;
  deleteHafiza: (id: string) => void;
  deleteAccount: (id: string) => void;
  deleteJournal: (id: string) => void;
  setOpeningBalance: (n: number) => void;
  importData: (d: { hafiza?: Hafiza[]; accounts?: Account[]; journal?: Journal[]; trainees?: Trainee[]; installments?: Installment[]; revenue?: RevenueMap }) => void;
  clearAll: () => void;
  clearTab: (tab: "hafiza" | "accounts" | "journal" | "installments" | "revenue" | "all" | string) => void;
  addInstallmentPayment: (name: string, month: string, amount: number) => void;
  updateInstallment: (name: string, patch: Partial<Installment>) => void;
  resetInstallments: () => void;
  setRevenue: (year: number, month: number, itemKey: string, amount: number) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const recalcInstallment = (i: Installment): Installment => {
  const totalPaid = Object.values(i.payments || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fees = Number(i.fees) || 0;
  const prevDue = Number(i.prevDue) || 0;
  return { ...i, fees, prevDue, totalPaid, remaining: prevDue - totalPaid };
};

const buildAccountFromHafiza = (h: Hafiza): Account => ({
  id: uid(),
  date: h.date,
  hafizaNo: h.hafizaNo,
  notifyNo: h.notifyNo || "",
  notifyDate: h.notifyDate || "",
  checkNo: "",
  checkDate: "",
  description: h.description,
  specialty: h.specialty,
  name: h.name,
  hafizaAmount: Number(h.hafizaAmount) || 0,
  income: Number(h.notifyAmount) || 0,   
  expense: 0,                   
  sourceHafizaId: h.id,
});

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
      customTabs: [],
      setRevenue: (year, month, itemKey, amount) =>
        set((s) => ({ revenue: { ...s.revenue, [`${year}-${month}-${itemKey}`]: amount } })),
      addTrainee: (t) =>
        set((s) =>
          s.trainees.find((x) => x.name === t.name) ? s : { trainees: [...s.trainees, t] }
        ),

      addHafiza: (h) => {
        const item = { ...h, id: uid(), hafizaAmount: Number(h.hafizaAmount) || 0, notifyAmount: Number(h.notifyAmount) || 0 };
        const acc = buildAccountFromHafiza(item);
        set((s) => ({
          hafiza: [...s.hafiza, item],
          accounts: [...s.accounts, acc]
        }));
        return item;
      },
      addAccount: (a) => {
        const item = { ...a, id: uid(), hafizaAmount: Number(a.hafizaAmount) || 0, income: Number(a.income) || 0, expense: Number(a.expense) || 0 };
        set((s) => ({ accounts: [...s.accounts, item] }));
        return item;
      },
      addJournal: (j) => {
        const item = { ...j, id: uid(), debit: Number(j.debit) || 0, credit: Number(j.credit) || 0 };
        set((s) => ({ journal: [...s.journal, item] }));
        return item;
      },
      updateHafiza: (id, h) =>
        set((s) => {
          const updatedHafiza = s.hafiza.map((x) => (x.id === id ? { ...x, ...h } : x));
          const newH = updatedHafiza.find((x) => x.id === id);
          if (!newH) return { hafiza: updatedHafiza };
          
          const linkedAcc = s.accounts.find((a) => a.sourceHafizaId === id);
          if (!linkedAcc) return { hafiza: updatedHafiza };
          
          const newAcc: Account = {
            ...linkedAcc,
            date: newH.date,
            hafizaNo: newH.hafizaNo,
            notifyNo: newH.notifyNo || linkedAcc.notifyNo,
            notifyDate: newH.notifyDate || linkedAcc.notifyDate,
            description: newH.description,
            specialty: newH.specialty,
            name: newH.name,
            hafizaAmount: Number(newH.hafizaAmount) || 0,
            income: Number(newH.notifyAmount) || 0, 
          };
          
          return { 
            hafiza: updatedHafiza, 
            accounts: s.accounts.map((a) => (a.id === linkedAcc.id ? newAcc : a)) 
          };
        }),
      updateAccount: (id, a) =>
        set((s) => {
          const accounts = s.accounts.map((x) => (x.id === id ? { ...x, ...a } : x));
          const newAcc = accounts.find((x) => x.id === id);
          if (!newAcc) return { accounts };
          
          let hafiza = s.hafiza;
          if (newAcc.sourceHafizaId) {
            hafiza = s.hafiza.map((h) => 
              h.id === newAcc.sourceHafizaId 
                ? { 
                    ...h, 
                    date: newAcc.date, 
                    hafizaNo: newAcc.hafizaNo, 
                    description: newAcc.description,
                    specialty: newAcc.specialty,
                    name: newAcc.name,
                    hafizaAmount: Number(newAcc.hafizaAmount) || 0,
                    notifyNo: newAcc.notifyNo,
                    notifyDate: newAcc.notifyDate,
                    notifyAmount: Number(newAcc.income) || 0
                  } 
                : h
            );
          }
          return { accounts, hafiza };
        }),
      updateJournal: (id, j) =>
        set((s) => ({ journal: s.journal.map((x) => (x.id === id ? { ...x, ...j } : x)) })),
      deleteHafiza: (id) =>
        set((s) => ({
          hafiza: s.hafiza.filter((x) => x.id !== id),
          accounts: s.accounts.filter((a) => a.sourceHafizaId !== id)
        })),
      deleteAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })),
      deleteJournal: (id) => 
        set((s) => ({ journal: s.journal.filter((x) => x.id !== id) })),
      setOpeningBalance: (n) => set({ openingBalance: n }),

      importData: (d) => set((s) => ({
        hafiza: d.hafiza ? [...s.hafiza, ...d.hafiza.map((h) => ({ 
          ...h, 
          id: h.id || uid(),
          hafizaAmount: Number(h.hafizaAmount) || 0,
          notifyAmount: Number(h.notifyAmount) || 0
        }))] : s.hafiza,
        accounts: d.accounts ? [...s.accounts, ...d.accounts.map((acc) => ({
          ...acc,
          id: acc.id || uid(),
          hafizaAmount: Number(acc.hafizaAmount) || 0,
          income: Number(acc.income) || 0,
          expense: Number(acc.expense) || 0,
        }))] : s.accounts,
        journal: d.journal ? [...s.journal, ...d.journal.map((j) => ({
          ...j,
          id: j.id || uid(),
          debit: Number(j.debit) || 0,
          credit: Number(j.credit) || 0
        }))] : s.journal,
        trainees: d.trainees ? [...s.trainees, ...d.trainees.filter((t) => !s.trainees.find((x) => x.name === t.name))] : s.trainees,
        installments: d.installments && d.installments.length
          ? Array.from(new Map([
              ...s.installments.map((i) => [i.name, i]),
              ...d.installments.map((i) => [i.name, recalcInstallment(i)])
            ]).values())
          : s.installments,
        revenue: d.revenue ? { ...s.revenue, ...d.revenue } : s.revenue,
      })),
      clearAll: () => set({ hafiza: [], accounts: [], journal: [] }),
      clearTab: (tab) =>
        set((s) => {
          switch (tab) {
            case "hafiza": return { hafiza: [] };
            case "accounts": return { accounts: [] };
            case "journal": return { journal: [] };
            case "installments": return { installments: (seedInstallments as Installment[]).map(recalcInstallment) };
            case "revenue": return { revenue: {} };
            case "all": return { hafiza: [], accounts: [], journal: [], revenue: {}, installments: (seedInstallments as Installment[]).map(recalcInstallment) };
            default: return s;
          }
        }),
      addInstallmentPayment: (name, month, amount) =>
        set((s) => ({
          installments: s.installments.map((i) =>
            i.name === name
              ? recalcInstallment({
                  ...i,
                  payments: { ...i.payments, [month]: (i.payments[month] || 0) + amount },
                })
              : i,
          ),
        })),
      updateInstallment: (name, patch) =>
        set((s) => ({
          installments: s.installments.map((i) =>
            i.name === name ? recalcInstallment({ ...i, ...patch, payments: patch.payments ?? i.payments }) : i,
          ),
        })),
      resetInstallments: () =>
        set({ installments: (seedInstallments as Installment[]).map(recalcInstallment) }),
    }),
    { name: "majlis-yemen-pure-link-v1" }
  )
);
