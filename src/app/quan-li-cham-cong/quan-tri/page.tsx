'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type Employee = { id: string; full_name: string; email: string }

function todayIsoDate() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export default function QuanTriChamCongPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [employees, setEmployees] = useState<Employee[]>([])
  const [resetUserId, setResetUserId] = useState('')
  const [resetDate, setResetDate] = useState(todayIsoDate())
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [savingPush, setSavingPush] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/employees')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setEmployees(data.employees)
      })
    fetch('/api/admin/misa-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPushEnabled(data.misa_push_enabled)
      })
  }, [isAdmin])

  async function togglePush() {
    if (pushEnabled === null) return
    const next = !pushEnabled
    setSavingPush(true)
    const res = await fetch('/api/admin/misa-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ misa_push_enabled: next }),
    })
    setSavingPush(false)
    if (res.ok) setPushEnabled(next)
  }

  async function handleResetDay() {
    const target = resetUserId ? employees.find((e) => e.id === resetUserId) : null
    const targetLabel = target ? `${target.full_name} (${target.email})` : 'CHÍNH BẠN'
    if (!confirm(`Xoá toàn bộ chấm công của ${targetLabel} ngày ${resetDate}? Không hoàn tác được.`)) return
    setResetting(true)
    setResetMsg('')
    try {
      const res = await fetch('/api/admin/attendance/reset-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: resetDate, userId: resetUserId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetMsg(data.error ?? 'Không xoá được')
        return
      }
      setResetMsg(`Đã xoá ${data.deleted} log`)
    } finally {
      setResetting(false)
    }
  }

  async function handleBackfill() {
    if (backfilling) return
    if (!confirm('Đồng bộ lại toàn bộ dữ liệu MISA từ 01/09/2026 đến giờ? Có thể mất chút thời gian.')) return
    setBackfilling(true)
    setBackfillMsg('')
    try {
      const res = await fetch('/api/admin/misa-sync-backfill', { method: 'POST' })
      const data = await res.json()
      setBackfillMsg(res.ok ? `Xong — lấy ${data.punchesFetched} lượt quẹt, ghi mới ${data.rowsInserted} dòng` : (data.error ?? 'Đồng bộ thất bại'))
    } finally {
      setBackfilling(false)
    }
  }

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản trị dữ liệu chấm công</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Xoá chấm công theo ngày</p>
          <p className="mb-3 text-xs text-amber-700">
            Xoá toàn bộ chấm công của 1 nhân viên trong 1 ngày (mặc định chính bạn) — dùng để test hoặc sửa dữ liệu
            lỗi. Không hoàn tác được.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={resetUserId}
              onChange={(e) => setResetUserId(e.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm min-w-[160px]"
            >
              <option value="">Chính tôi</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.email})
                </option>
              ))}
            </select>
            <input
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleResetDay}
              disabled={resetting}
              className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Xoá dữ liệu ngày này
            </button>
          </div>
          {resetMsg && <p className="mt-2 text-xs text-amber-800">{resetMsg}</p>}
        </div>

        {user?.is_super_admin && (
          <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">Đồng bộ lại MISA từ đầu tháng 9</p>
            <p className="mb-3 text-xs text-brand-700">
              Kéo lại toàn bộ dữ liệu chấm công thô từ MISA AMIS kể từ 01/09/2026 tới giờ, bỏ qua mốc đồng bộ gần
              nhất — dùng khi cần lấy bù dữ liệu cũ (vd mới cấu hình xong mã nhân viên). Chỉ Super Admin thấy được
              nút này.
            </p>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {backfilling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Đồng bộ từ 01/09/2026
            </button>
            {backfillMsg && <p className="mt-2 text-xs text-brand-800">{backfillMsg}</p>}
          </div>
        )}

        {user?.is_super_admin && (
          <div className="rounded-2xl border border-dashed border-red-300 bg-red-50/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Đẩy chấm công iHNS lên MISA</p>
            <p className="mb-3 text-xs text-red-700">
              Khi bật: mỗi lần nhân viên chấm công qua web iHNS sẽ tự động gửi thêm 1 lượt chấm công thật sang MISA
              AMIS. Ảnh hưởng dữ liệu thật bên MISA — chỉ bật khi đã kiểm tra kỹ.
            </p>
            {pushEnabled === null ? (
              <Loader2 size={14} className="animate-spin text-red-400" />
            ) : (
              <button
                onClick={togglePush}
                disabled={savingPush}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ${
                  pushEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 hover:bg-gray-500'
                }`}
              >
                {savingPush && <Loader2 size={14} className="animate-spin" />}
                {pushEnabled ? 'Đang BẬT — bấm để tắt' : 'Đang tắt — bấm để bật'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
