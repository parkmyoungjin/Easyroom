// src/components/forms/ControlledDateInput.tsx

import { DateInput, DateInputProps } from '@mantine/dates';
import { Controller, Control, FieldValues, Path, PathValue } from 'react-hook-form';

// react-hook-form의 Control과 name, 그리고 Mantine DateInput의 나머지 props를 받도록 타입을 정의합니다.
type ControlledDateInputProps<T extends FieldValues> = Omit<DateInputProps, 'value' | 'onChange'> & {
    control: Control<T>;
    name: Path<T>;
    onDateChange?: (date: Date | null) => void; // 날짜 변경 시 추가 로직을 위한 콜백
};

export function ControlledDateInput<T extends FieldValues>({
    control,
    name,
    onDateChange,
    ...rest // label, placeholder 등 Mantine DateInput의 나머지 props
}: ControlledDateInputProps<T>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState: { error } }) => {
                // --- 어댑터의 핵심 로직 시작 ---

                // 1. react-hook-form의 값을 Mantine DateInput이 이해할 수 있는 형태로 변환
                let mantineValue: string | null = null;

                if (field.value && typeof field.value === 'object' && 'getTime' in field.value) {
                    // Date 객체인 경우 ISO 문자열로 변환
                    mantineValue = (field.value as Date).toISOString().split('T')[0];
                } else if (typeof field.value === 'string') {
                    mantineValue = field.value;
                }
                // 그 외의 경우(null, undefined 등)는 mantineValue가 null로 유지됩니다.

                // 2. Mantine의 onChange에서 받은 문자열 값을 Date 객체로 변환하여 전달
                const handleChange = (dateString: string | null) => {
                    let dateValue: Date | null = null;

                    if (dateString) {
                        dateValue = new Date(dateString);
                        // 유효하지 않은 날짜인 경우 null로 처리
                        if (isNaN(dateValue.getTime())) {
                            dateValue = null;
                        }
                    }

                    field.onChange(dateValue as PathValue<T, Path<T>>);
                    // 추가 로직이 필요한 경우 콜백 실행
                    onDateChange?.(dateValue);
                };

                // --- 어댑터의 핵심 로직 끝 ---

                return (
                    <DateInput
                        {...rest}
                        value={mantineValue}
                        onChange={handleChange}
                        error={error?.message} // react-hook-form의 에러 메시지를 Mantine 컴포넌트에 연결
                    />
                );
            }}
        />
    );
}