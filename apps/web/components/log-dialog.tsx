'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';

export type InputSchema =
  | 'numeric_success'
  | 'numeric_score'
  | 'text_reflection';

export function LogDialog({
  eventId,
  schema,
}: {
  eventId: string;
  schema: InputSchema;
}) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data: Record<string, string>) => {
    const payload: Record<string, unknown> = { eventId, type: schema };

    if (schema === 'numeric_success') {
      payload.attempts = Number(data.attempts);
      payload.successes = Number(data.successes);
    } else if (schema === 'numeric_score') {
      payload.score = Number(data.score);
    } else {
      payload.text = data.text;
    }

    await api.createLog(payload);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Log</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Log</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {schema === 'numeric_success' && (
            <>
              <Label>Attempts</Label>
              <Input type="number" {...register('attempts')} />

              <Label>Successes</Label>
              <Input type="number" {...register('successes')} />
            </>
          )}

          {schema === 'numeric_score' && (
            <>
              <Label>Score</Label>
              <Input type="number" {...register('score')} />
            </>
          )}

          {schema === 'text_reflection' && (
            <>
              <Label>Reflection</Label>
              <Textarea {...register('text')} />
            </>
          )}

          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}