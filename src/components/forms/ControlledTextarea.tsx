// src/components/forms/ControlledTextarea.tsx
import { Textarea, TextareaProps } from '@mantine/core';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';

type ControlledTextareaProps<T extends FieldValues> = Omit<TextareaProps, 'value' | 'onChange'> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledTextarea<T extends FieldValues>({ 
  control, 
  name, 
  ...rest 
}: ControlledTextareaProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <Textarea 
          {...rest} 
          {...field} 
          error={error?.message} 
        />
      )}
    />
  );
}