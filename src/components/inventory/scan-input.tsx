'use client';

import { useState } from 'react';

interface ScanInputProps {
  onScan: (raw: string) => void;
  placeholder?: string;
}

/** Text input with autofocus for USB/Bluetooth scanners (they type + Enter). */
export function ScanInput({ onScan, placeholder }: ScanInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value;
    setValue('');
    if (!raw.trim()) return;
    onScan(raw);
  }

  return (
    <form onSubmit={handleSubmit} data-testid="scan-input">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? 'Escanear código...'}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
        data-testid="scan-input-field"
      />
    </form>
  );
}
