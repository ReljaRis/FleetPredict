import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import { Button, Drawer, useToast } from './ui'

export type Values = Record<string, string | boolean>
export interface Field {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'checkbox'
  options?: { value: string; label: string }[]
  required?: boolean
  span?: boolean
  hint?: string
  placeholder?: string
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  fields: Field[]
  initial: Values
  submitLabel: string
  successText: string
  onSubmit: (values: Values) => Promise<unknown>
  onDone?: () => void
  danger?: { label: string; run: () => Promise<unknown>; successText: string }
}

const base = 'mt-1.5 w-full rounded-md border bg-white px-3 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-amber'

/**
 * Schema-driven form in a side drawer. Handles required fields, server-side field errors,
 * a busy state, success and failure feedback, and an optional confirmed delete.
 */
export function FormDrawer({ open, onClose, title, sub, fields, initial, submitLabel, successText, onSubmit, onDone, danger }: Props) {
  const toast = useToast()
  const [values, setValues] = useState<Values>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(initial)
    setErrors({})
    setFormError(null)
    setConfirmDelete(false)
    // The drawer re-initialises each time it opens, not on every change of the initial object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (name: string, v: string | boolean) => {
    setValues((x) => ({ ...x, [name]: v }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }))
    setFormError(null)
  }

  function payload(): Values {
    const out: Values = { ...values }
    for (const f of fields) if (f.type === 'datetime' && out[f.name]) out[f.name] = new Date(String(out[f.name])).toISOString()
    return out
  }

  async function save() {
    const e: Record<string, string> = {}
    for (const f of fields) if (f.required && f.type !== 'checkbox' && !String(values[f.name] ?? '').trim()) e[f.name] = 'This field is required.'
    setErrors(e)
    if (Object.keys(e).length) return setFormError('Some fields need attention.')
    setBusy('save')
    setFormError(null)
    try {
      await onSubmit(payload())
      toast(successText)
      onDone?.()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {})
        setFormError(err.fields && Object.keys(err.fields).length ? 'Some fields need attention.' : err.message)
      } else setFormError('Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!danger) return
    setBusy('delete')
    try {
      await danger.run()
      toast(danger.successText)
      onDone?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      setConfirmDelete(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        <>
          {danger &&
            (confirmDelete ? (
              <span className="mr-auto flex items-center gap-2">
                <Button variant="danger" size="sm" loading={busy === 'delete'} onClick={remove}>Confirm delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
              </span>
            ) : (
              <Button variant="danger" size="sm" className="mr-auto" onClick={() => setConfirmDelete(true)}>{danger.label}</Button>
            ))}
          {formError && !confirmDelete && <p role="alert" className="text-sm text-critical">{formError}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy === 'save'} onClick={save}>{submitLabel}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }} noValidate className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {fields.map((f) => {
          const err = errors[f.name]
          const cls = `${base} ${err ? 'border-critical' : 'border-line'}`
          const id = `f-${f.name}`
          return (
            <div key={f.name} className={f.span || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-[15px]">
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="size-4 accent-night" /> {f.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="block text-sm font-medium text-ink">
                    {f.label} {f.required && <span className="text-critical" aria-hidden="true">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select id={id} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={`${cls} h-10`}>
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea id={id} rows={3} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} className={`${cls} py-2`} />
                  ) : (
                    <input
                      id={id}
                      type={f.type === 'datetime' ? 'datetime-local' : f.type === 'date' ? 'date' : 'text'}
                      inputMode={f.type === 'number' ? 'decimal' : undefined}
                      value={String(values[f.name] ?? '')}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      aria-invalid={!!err}
                      className={`${cls} h-10`}
                    />
                  )}
                </>
              )}
              {f.hint && !err && <p className="mt-1 text-xs text-ink-3">{f.hint}</p>}
              {err && <p className="mt-1 text-sm text-critical">{err}</p>}
            </div>
          )
        })}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  )
}
