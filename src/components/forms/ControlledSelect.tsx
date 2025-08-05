// src/components/forms/ControlledSelect.tsx
import { Select, SelectProps } from '@mantine/core';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';

type ControlledSelectProps<T extends FieldValues> = Omit<SelectProps, 'value' | 'onChange'> & {
  control: Control<T>;
  name: Path<T>;
  onSelectionChange?: (value: string | null) => void;
};

export function ControlledSelect<T extends FieldValues>({ 
  control, 
  name, 
  onSelectionChange,
  ...rest 
}: ControlledSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <Select 
          {...rest} 
          {...field} 
          error={error?.message}
          onChange={(value) => {
            field.onChange(value);
            onSelectionChange?.(value);
          }}
        />
      )}
    />
  );
}