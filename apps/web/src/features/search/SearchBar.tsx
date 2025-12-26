import { useState, useCallback, useEffect } from 'react';
import { TextInput, ActionIcon } from '@mantine/core';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search tags...',
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  // Sync with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  return (
    <TextInput
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      leftSection={<Search size={16} />}
      rightSection={
        localValue ? (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={14} />
          </ActionIcon>
        ) : null
      }
      rightSectionPointerEvents="all"
    />
  );
}

