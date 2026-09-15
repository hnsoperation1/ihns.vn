'use client'

import { useEffect, useState } from 'react'
import { Clock, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  is_default: boolean
  is_active: boolean
}

const EMPTY_FORM = { name: '', start: '08:00', end: '17:00', breakMinutes: '60' }

function standardHours(shift: Pick<Shift, 'start_time' | 'end_time' | 'break_minutes'>) {
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const [eh, em] = shift.end_time.split(':').map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm) - shift.break_minutes
  return (minutes / 60).toFixed(1)
}

export default function CaLamViecPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/shifts')
    if (res.ok) setShifts((await res.json()).shifts)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    const res = await fetch('/api/admin/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    setSavingId(null)
    if (res.ok) load()
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit() {
    setError('')
    const breakMinutes = Number(form.breakMinutes)
    if (!form.name.trim() || !form.start || !form.end || Number.isNaN(breakMinutes)) {
      setError('Nhập đủ tên ca, giờ vào, giờ ra')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), startTime: form.start, endTime: form.end, breakMinutes }),
    })
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      load()
    } else {
      setError('Không tạo được ca')
    }
  }

  async function removeShift(id: string) {
    if (!confirm('Xoá ca làm việc này?')) return
    await fetch(`/api/admin/shifts?id=${id}`, { method: 'DELETE' })
    load()
  }

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <BackLink />
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Ca làm việc</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-semibold hover:bg-accent-600 transition-colors shadow-sm"
        >
          <Plus size={16} /> Thêm ca
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Giờ chuẩn của ca dùng để tính đủ công/thiếu công/đi muộn/làm thêm giờ trên Bảng công. Nhân viên chưa được gán
        ca riêng sẽ tự dùng ca đang đặt Mặc định.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Clock size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">Chưa có ca nào</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3">Tên ca</th>
                <th className="px-5 py-3">Giờ vào - ra</th>
                <th className="px-5 py-3">Nghỉ giữa ca</th>
                <th className="px-5 py-3">Công chuẩn</th>
                <th className="px-5 py-3">Mặc định</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/70">
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{s.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.break_minutes} phút</td>
                  <td className="px-5 py-3.5 text-gray-500">{standardHours(s)}h</td>
                  <td className="px-5 py-3.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={s.is_default} onChange={(e) => patch(s.id, { isDefault: e.target.checked })} />
                      {savingId === s.id && <Loader2 size={12} className="animate-spin text-gray-400" />}
                    </label>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                      <button onClick={() => removeShift(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">Thêm ca mới</p>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Tên ca (vd Ca hành chính)"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Giờ vào</label>
                  <input
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Giờ ra</label>
                  <input
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nghỉ giữa ca (phút)</label>
                <input
                  type="number"
                  value={form.breakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors font-medium">
                Huỷ
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-semibold hover:bg-accent-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Tạo ca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
