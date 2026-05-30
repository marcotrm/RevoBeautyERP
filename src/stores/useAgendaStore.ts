'use client';

import { create } from 'zustand';
import { Appointment } from '@/types';
import { mockOperators } from '@/lib/mock-data';
import { getAppointments, createAppointment, updateAppointmentAction, deleteAppointmentAction } from '@/app/actions/agenda';

type AgendaView = 'day' | 'week' | 'month';

interface AgendaStore {
  appointments: Appointment[];
  selectedDate: Date;
  view: AgendaView;
  selectedOperatorIds: string[];
  selectedAppointment: Appointment | null;
  isAppointmentModalOpen: boolean;
  editingAppointment: Appointment | null;
  slotInfo: { operatorId: string; time: string } | null;
  isLoading: boolean;

  fetchAppointments: () => Promise<void>;
  setSelectedDate: (date: Date) => void;
  setView: (view: AgendaView) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  toggleOperator: (id: string) => void;
  setSelectedOperatorIds: (ids: string[]) => void;

  selectAppointment: (appointment: Appointment | null) => void;
  openAppointmentModal: (appointment?: Appointment | null, slotInfo?: { operatorId: string; time: string } | null) => void;
  closeAppointmentModal: () => void;

  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  moveAppointment: (id: string, operatorId: string, startTime: string, endTime: string) => Promise<void>;
}

export const useAgendaStore = create<AgendaStore>((set, get) => ({
  appointments: [],
  selectedDate: new Date(),
  view: 'day',
  selectedOperatorIds: mockOperators.map(op => op.id),
  selectedAppointment: null,
  isAppointmentModalOpen: false,
  editingAppointment: null,
  slotInfo: null,
  isLoading: false,

  fetchAppointments: async () => {
    set({ isLoading: true });
    try {
      const data = await getAppointments();
      set({ appointments: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
  setView: (view) => set({ view }),

  goToToday: () => set({ selectedDate: new Date() }),

  goToPrev: () => {
    const { selectedDate, view } = get();
    const d = new Date(selectedDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    set({ selectedDate: d });
  },

  goToNext: () => {
    const { selectedDate, view } = get();
    const d = new Date(selectedDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    set({ selectedDate: d });
  },

  toggleOperator: (id) =>
    set((state) => {
      const ids = state.selectedOperatorIds.includes(id)
        ? state.selectedOperatorIds.filter((i) => i !== id)
        : [...state.selectedOperatorIds, id];
      return { selectedOperatorIds: ids };
    }),

  setSelectedOperatorIds: (ids) => set({ selectedOperatorIds: ids }),

  selectAppointment: (appointment) => set({ selectedAppointment: appointment }),

  openAppointmentModal: (appointment, slotInfo) =>
    set({ isAppointmentModalOpen: true, editingAppointment: appointment || null, slotInfo: slotInfo || null }),

  closeAppointmentModal: () =>
    set({ isAppointmentModalOpen: false, editingAppointment: null, slotInfo: null }),

  addAppointment: async (appointmentData) => {
    try {
      const newApt = await createAppointment(appointmentData);
      set((state) => ({ appointments: [...state.appointments, newApt] }));
    } catch (error) {
      console.error('Failed to add appointment', error);
      throw error;
    }
  },

  updateAppointment: async (id, updates) => {
    try {
      const updatedApt = await updateAppointmentAction(id, updates);
      set((state) => ({
        appointments: state.appointments.map((a) => (a.id === id ? updatedApt : a)),
      }));
    } catch (error) {
      console.error('Failed to update appointment', error);
      throw error;
    }
  },

  deleteAppointment: async (id) => {
    try {
      await deleteAppointmentAction(id);
      set((state) => ({
        appointments: state.appointments.filter((a) => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete appointment', error);
      throw error;
    }
  },

  moveAppointment: async (id, operatorId, startTime, endTime) => {
    try {
      const op = mockOperators.find((o) => o.id === operatorId);
      const updates = {
        operatorId,
        operatorName: op ? `${op.firstName} ${op.lastName}` : '',
        startTime,
        endTime
      };
      const updatedApt = await updateAppointmentAction(id, updates);
      set((state) => ({
        appointments: state.appointments.map((a) => (a.id === id ? updatedApt : a)),
      }));
    } catch (error) {
      console.error('Failed to move appointment', error);
      throw error;
    }
  },
}));
