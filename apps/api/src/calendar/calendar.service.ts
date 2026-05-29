import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SlotOccurrence {
  start: Date;
  end: Date;
}

function expandSlotOccurrences(
  slot: {
    startTime: Date;
    endTime: Date;
    recurrence: string;
    recurrenceEndDate: Date | null;
  },
  limit: Date,
): SlotOccurrence[] {
  const duration = slot.endTime.getTime() - slot.startTime.getTime();

  if (slot.recurrence === 'NONE') {
    return [{ start: new Date(slot.startTime), end: new Date(slot.endTime) }];
  }

  const upperBound = slot.recurrenceEndDate
    ? new Date(Math.min(slot.recurrenceEndDate.getTime(), limit.getTime()))
    : limit;

  const occurrences: SlotOccurrence[] = [];
  const current = new Date(slot.startTime);

  while (current <= upperBound && occurrences.length < 500) {
    occurrences.push({
      start: new Date(current),
      end: new Date(current.getTime() + duration),
    });

    switch (slot.recurrence) {
      case 'DAILY':
        current.setDate(current.getDate() + 1);
        break;
      case 'WEEKLY':
        current.setDate(current.getDate() + 7);
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return occurrences;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Authorization helper ─────────────────────────────────────────────────

  private async assertCoachPlayerLink(coachId: string, playerId: string) {
    const link = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
    });
    if (!link) {
      throw new ForbiddenException('Not linked to this player');
    }
  }

  // ─── Practice Slots ───────────────────────────────────────────────────────

  async listSlots(userId: string, playerId?: string) {
    const targetId = playerId ?? userId;

    if (targetId !== userId) {
      await this.assertCoachPlayerLink(userId, targetId);
    }

    return this.prisma.practiceSlot.findMany({
      where: { playerId: targetId },
      orderBy: { startTime: 'asc' },
    });
  }

  async createSlot(
    userId: string,
    data: {
      title: string;
      startTime: string;
      endTime: string;
      recurrence?: string;
      recurrenceEndDate?: string;
    },
  ) {
    return this.prisma.practiceSlot.create({
      data: {
        playerId: userId,
        title: data.title,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        recurrence: (data.recurrence as any) ?? 'NONE',
        recurrenceEndDate: data.recurrenceEndDate
          ? new Date(data.recurrenceEndDate)
          : null,
      },
    });
  }

  async updateSlot(
    userId: string,
    slotId: string,
    data: {
      title?: string;
      startTime?: string;
      endTime?: string;
      recurrence?: string;
      recurrenceEndDate?: string | null;
    },
  ) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');
    if (slot.playerId !== userId)
      throw new ForbiddenException('Not your practice slot');

    return this.prisma.practiceSlot.update({
      where: { id: slotId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.startTime !== undefined
          ? { startTime: new Date(data.startTime) }
          : {}),
        ...(data.endTime !== undefined
          ? { endTime: new Date(data.endTime) }
          : {}),
        ...(data.recurrence !== undefined
          ? { recurrence: data.recurrence as any }
          : {}),
        ...(data.recurrenceEndDate !== undefined
          ? {
              recurrenceEndDate: data.recurrenceEndDate
                ? new Date(data.recurrenceEndDate)
                : null,
            }
          : {}),
      },
    });
  }

  async deleteSlot(userId: string, slotId: string) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');
    if (slot.playerId !== userId)
      throw new ForbiddenException('Not your practice slot');

    await this.prisma.practiceSlot.delete({ where: { id: slotId } });
    return { ok: true };
  }

  // ─── Calendar Tasks ───────────────────────────────────────────────────────

  async listSlotTasks(userId: string, slotId: string) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');

    if (slot.playerId !== userId) {
      await this.assertCoachPlayerLink(userId, slot.playerId);
    }

    return this.prisma.calendarTask.findMany({
      where: { practiceSlotId: slotId },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async assignTask(
    coachId: string,
    slotId: string,
    data: {
      title: string;
      description: string;
      durationMinutes: number;
      scheduledDate: string;
      recurrenceCount?: number;
      recurrenceWeeks?: number;
    },
  ) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');

    await this.assertCoachPlayerLink(coachId, slot.playerId);

    const scheduledDate = new Date(data.scheduledDate);

    // Validate that the task time-of-day fits within the slot window
    const slotStartMins =
      slot.startTime.getUTCHours() * 60 + slot.startTime.getUTCMinutes();
    const slotEndMins =
      slot.endTime.getUTCHours() * 60 + slot.endTime.getUTCMinutes();
    const taskStartMins =
      scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes();
    const taskEndMins = taskStartMins + data.durationMinutes;

    if (taskStartMins < slotStartMins || taskEndMins > slotEndMins) {
      throw new BadRequestException(
        'Task time must be within the practice slot window',
      );
    }

    // Single task
    if (!data.recurrenceCount || !data.recurrenceWeeks) {
      return [
        await this.prisma.calendarTask.create({
          data: {
            practiceSlotId: slotId,
            coachId,
            title: data.title,
            description: data.description,
            durationMinutes: data.durationMinutes,
            scheduledDate,
          },
        }),
      ];
    }

    // Recurring: find slot occurrences within the next recurrenceWeeks weeks
    const windowEnd = new Date(scheduledDate);
    windowEnd.setDate(windowEnd.getDate() + data.recurrenceWeeks * 7);

    const occurrences = expandSlotOccurrences(slot, windowEnd).filter(
      (occ) => occ.start >= scheduledDate,
    );

    if (occurrences.length === 0) {
      throw new BadRequestException(
        'No practice slot occurrences found in the specified window',
      );
    }

    // Evenly distribute up to recurrenceCount occurrences
    const step = Math.max(
      1,
      Math.floor(occurrences.length / data.recurrenceCount),
    );
    const selected = occurrences
      .filter((_, i) => i % step === 0)
      .slice(0, data.recurrenceCount);

    const tasks = await Promise.all(
      selected.map((occ) => {
        const taskDate = new Date(occ.start);
        taskDate.setUTCHours(scheduledDate.getUTCHours());
        taskDate.setUTCMinutes(scheduledDate.getUTCMinutes());
        taskDate.setUTCSeconds(0);
        taskDate.setUTCMilliseconds(0);
        return this.prisma.calendarTask.create({
          data: {
            practiceSlotId: slotId,
            coachId,
            title: data.title,
            description: data.description,
            durationMinutes: data.durationMinutes,
            scheduledDate: taskDate,
          },
        });
      }),
    );

    return tasks;
  }

  async updateTask(
    coachId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      scheduledDate?: string;
    },
  ) {
    const task = await this.prisma.calendarTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.coachId !== coachId) throw new ForbiddenException('Not your task');

    return this.prisma.calendarTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.durationMinutes !== undefined
          ? { durationMinutes: data.durationMinutes }
          : {}),
        ...(data.scheduledDate !== undefined
          ? { scheduledDate: new Date(data.scheduledDate) }
          : {}),
      },
    });
  }

  async deleteTask(coachId: string, taskId: string) {
    const task = await this.prisma.calendarTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.coachId !== coachId) throw new ForbiddenException('Not your task');

    await this.prisma.calendarTask.delete({ where: { id: taskId } });
    return { ok: true };
  }

  // ─── Full Calendar View ───────────────────────────────────────────────────

  async getPlayerCalendar(userId: string, playerId: string) {
    if (userId !== playerId) {
      await this.assertCoachPlayerLink(userId, playerId);
    }

    const slots = await this.prisma.practiceSlot.findMany({
      where: { playerId },
      include: { tasks: true },
      orderBy: { startTime: 'asc' },
    });

    // Expand slot occurrences for the next 12 months
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() + 1);

    const expandedSlots = slots.map((slot) => ({
      id: slot.id,
      title: slot.title,
      recurrence: slot.recurrence,
      recurrenceEndDate: slot.recurrenceEndDate,
      occurrences: expandSlotOccurrences(slot, limit),
      tasks: slot.tasks,
    }));

    return { slots: expandedSlots };
  }
}
