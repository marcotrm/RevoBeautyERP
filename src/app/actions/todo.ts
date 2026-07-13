'use server';

import { prisma } from '@/lib/prisma';
import { TodoItem } from '@/types';

export async function getTodos() {
  const todos = await prisma.todoItem.findMany({ orderBy: { createdAt: 'desc' } });
  return todos as unknown as TodoItem[];
}

export async function createTodo(data: { title: string; priority?: string; dueDate?: string; assignee?: string }) {
  const todo = await prisma.todoItem.create({
    data: {
      title: data.title,
      priority: data.priority || 'normal',
      dueDate: data.dueDate || null,
      assignee: data.assignee || null,
      done: false,
      createdAt: new Date().toISOString(),
    },
  });
  return todo as unknown as TodoItem;
}

export async function updateTodo(id: string, updates: Partial<TodoItem>) {
  const todo = await prisma.todoItem.update({
    where: { id },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate || null } : {}),
      ...(updates.assignee !== undefined ? { assignee: updates.assignee || null } : {}),
      ...(updates.done !== undefined ? { done: updates.done, completedAt: updates.done ? new Date().toISOString() : null } : {}),
    },
  });
  return todo as unknown as TodoItem;
}

export async function deleteTodo(id: string) {
  await prisma.todoItem.delete({ where: { id } });
  return true;
}
