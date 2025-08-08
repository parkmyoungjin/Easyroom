// src/components/forms/ControlledCalendar.tsx

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import { Button, Text } from "@mantine/core";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ControlledCalendarProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: Date;
  excludeDate?: (date: Date) => boolean;
  onDateChange?: (date: Date | null) => void;
  className?: string;
};

export function ControlledCalendar<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "날짜를 선택하세요",
  disabled = false,
  required = false,
  minDate,
  excludeDate,
  onDateChange,
  className,
}: ControlledCalendarProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        const handleSelect = (date: Date | undefined) => {
          field.onChange(date || null);
          onDateChange?.(date || null);
          setOpen(false); // 날짜 선택 후 팝오버 자동 닫기
        };

        return (
          <div className={className} style={{ marginBottom: '1rem' }}>
            {label && (
              <Text size="sm" fw={500} mb={4}>
                {label}
                {required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}
              </Text>
            )}

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  fullWidth
                  justify="flex-start"
                  leftSection={<CalendarIcon size={16} />}
                  disabled={disabled}
                  style={{
                    color: field.value ? undefined : '#868e96',
                    borderColor: error ? '#fa5252' : undefined,
                  }}
                >
                  {field.value ? (
                    format(field.value, "yyyy년 M월 d일", { locale: ko })
                  ) : (
                    placeholder
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent style={{ width: 'auto', padding: 0 }}>
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={handleSelect}
                  disabled={(date) => {
                    // 최소 날짜 체크 (시간 부분 제거하여 정확한 날짜 비교)
                    if (minDate) {
                      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                      const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                      if (dateOnly < minDateOnly) {
                        return true;
                      }
                    }
                    // 커스텀 제외 날짜 체크
                    if (excludeDate && excludeDate(date)) {
                      return true;
                    }
                    return false;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {error && (
              <Text size="sm" c="red" mt={4}>
                {error.message}
              </Text>
            )}
          </div>
        );
      }}
    />
  );
}