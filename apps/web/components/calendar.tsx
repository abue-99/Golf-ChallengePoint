
'use client';

import { useEffect, useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { api } from '@/lib/api';

type ApiEvent = {
  id: string;
  start: string;
  end: string;
  template?: {
    title?: string;
  };
};

type EventType = {
  id: string;
  title: string;
  start: string;
  end: string;
};

type EventReceiveInfo = {
  draggedEl: HTMLElement;
  date: Date;
  event: { setProp: (name: string, value: unknown) => void };
  revert: () => void;
};

type EventChangeInfo = {
  event: { id: string; start: Date; end: Date | null };
  revert: () => void;
};

export default function PlayerCalendar({ playerId }: { playerId: string }) {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const data: ApiEvent[] = await api.listEvents(playerId);

        if (!ignore) {
          setEvents(
            data.map((e: ApiEvent) => ({
              id: e.id,
              title: e.template?.title ?? 'Task',
              start: e.start,
              end: e.end,
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [playerId]);

  const handleReceive = async (info: EventReceiveInfo) => {
    try {
      const created = await api.createEvent({
        playerId,
        templateId: info.draggedEl.dataset.id,
        start: info.date.toISOString(),
        end: info.date.toISOString(),
      });

      info.event.setProp('id', created.id);
    } catch (e) {
      info.revert();
    }
  };

  const handleDropOrResize = async (info: EventChangeInfo) => {
    try {
      await api.updateEvent(info.event.id, {
        start: info.event.start.toISOString(),
        end: info.event.end?.toISOString(),
      });
    } catch (e) {
      info.revert();
    }
  };

  const ev = useMemo(() => events, [events]);

  if (loading) return <div>Loading…</div>;

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      events={ev}
      droppable
      editable
      eventReceive={handleReceive}
      eventDrop={handleDropOrResize}
      eventResize={handleDropOrResize}
    />
  );
}
