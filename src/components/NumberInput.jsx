import React, { useEffect, useRef, useState } from 'react'

const displayValue = (value, precision) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return precision === undefined ? String(value) : number.toFixed(precision)
}

export function NumberInput({ value, onValueChange, min, max, precision, onFocus, onBlur, onKeyDown, ...props }) {
  const focused = useRef(false)
  const latestValue = useRef(value)
  const [draft, setDraft] = useState(() => displayValue(value, precision))
  latestValue.current = value

  useEffect(() => {
    if (!focused.current) setDraft(displayValue(value, precision))
  }, [value, precision])

  const parseDraft = (raw) => {
    if (raw.trim() === '') return null
    const number = Number(raw)
    return Number.isFinite(number) ? number : null
  }

  const commit = () => {
    focused.current = false
    const parsed = parseDraft(draft)
    if (parsed === null) {
      setDraft(displayValue(latestValue.current, precision))
      return
    }
    const lower = min === undefined ? -Infinity : Number(min)
    const upper = max === undefined ? Infinity : Number(max)
    const next = Math.min(upper, Math.max(lower, parsed))
    onValueChange(next)
    setDraft(displayValue(next, precision))
  }

  return <input
    {...props}
    type="number"
    min={min}
    max={max}
    value={draft}
    onFocus={(event) => { focused.current = true; onFocus?.(event) }}
    onChange={(event) => {
      const raw = event.target.value
      setDraft(raw)
      const parsed = parseDraft(raw)
      if (parsed !== null) onValueChange(parsed)
    }}
    onBlur={(event) => { commit(); onBlur?.(event) }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur()
      onKeyDown?.(event)
    }}
  />
}
