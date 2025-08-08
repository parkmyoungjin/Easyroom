// src/components/forms/ControlledTextInput.tsx
import { TextInput, TextInputProps } from '@mantine/core';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';

type ControlledTextInputProps<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChange'> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledTextInput<T extends FieldValues>({
  control,
  name,
  ...rest
}: ControlledTextInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <TextInput
          {...rest}
          {...field}
          error={error?.message}
        />
      )}
    />
  );
}