import { prisma } from '../config/prisma';
import type { NotificationCategory } from '@prisma/client';

export interface CreateNotificationInput {
  userId?: string | null;
  title: string;
  body: string;
  category: NotificationCategory;
  link?: string;
}

export async function notify(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId ?? null,
        title: input.title,
        body: input.body,
        category: input.category,
        link: input.link ?? null,
      },
    });
  } catch {
    // Notification failure must not block the main flow.
  }
}

export async function notifyMany(userIds: string[], base: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
  if (!userIds.length) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: base.title,
        body: base.body,
        category: base.category,
        link: base.link ?? null,
      })),
    });
  } catch {
    // ignore
  }
}
