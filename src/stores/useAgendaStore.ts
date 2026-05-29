'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Appointment } from '@/types';
import { mockAppointments, mockOperators } from '@/lib/mock-data';
import { generateId } from '@/lib/helpers';

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

  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  moveAppointment: (id: string, operatorId: string, startTime: string, endTime: string) => void;
}

export const useAgendaStore = create<AgendaStore>()(
  persist(
    (set, get) => ({
      appointments: mockAppointments,
      selectedDate: new Date(),
      view: 'day',
      selectedOperatorIds: mockOperators.map(op => op.id),
      selectedAppointment: null,
      isAppointmentModalOpen: false,
      editingAppointment: null,
      slotInfo: null,

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

      addAppointment: (appointmentData) =>
        set((state) => ({
          appointments: [
            ...state.appointments,
            {
              ...appointmentData,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'u1',
            } as Appointment,
          ],
        })),

      updateAppointment: (id, updates) =>
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          ),
        })),

      deleteAppointment: (id) =>
        set((state) => ({
          appointments: state.appointments.filter((a) => a.id !== id),
        })),

      moveAppointment: (id, operatorId, startTime, endTime) =>
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  operatorId,
                  operatorName: mockOperators.find((op) => op.id === operatorId)?.firstName + ' ' + mockOperators.find((op) => op.id === operatorId)?.lastName || a.operatorName,
                  startTime,
                  endTime,
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
        })),
    }),
    {
      name: 'revo_agenda',
      partialize: (state) => ({ appointments: state.appointments }),
    }
  )
);
