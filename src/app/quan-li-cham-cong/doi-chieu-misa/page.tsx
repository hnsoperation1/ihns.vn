'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type DoiChieuRow = {
  user_id: string
  full_name: string
  misa_employee_code: string
  misa: { totalWorking: number; totalWorkingActual: number; totalOverTime: number; totalLeave: number; totalLateOutEarly: number } | null
  ihns: { tongCongDays: number; otHours: number; lateEarlyCount: number; nghiDays: number } | null
  otDiff: number | null
  lateEarlyDiff: number | null
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Đối chiếu bảng công MISA tự tính (get-data-timesheet-summary) với bảng
// công iHNS tự tính (dùng nguyên công thức của /api/admin/timesheet) — chỉ
// so 2 chỉ số cùng đơn vị: giờ làm thêm, số lần đi muộn/về sớm. Các số khác
// (tổng công MISA tính theo giờ, iHNS tính theo ngày) hiện song song để đối
// chiếu bằng mắt, không ép ra 1 con số chênh lệch sai đơn vị.
export default function DoiChieuMisaPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [month, setMonth] = useState(currentMonthKey())
  const [rows, setRows] = useState<DoiChieuRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    setRows(null)
    setError('')
    fetch(`/api/admin/misa-doi-chieu?month=${month}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? 'Không đối chiếu được')
          setRows([])
          return
        }
        setRows(data.rows ?? [])
      })
      .catch(() => {
        setError('Không đối chiếu được')
        setRows([])
      })
  }, [isAdmin, month])

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Đối chiếu MISA</h1>
      <p className="mb-6 text-sm text-gray-400">
        So bảng công MISA tự tính với bảng công iHNS tự tính, theo từng nhân viên đã khớp mã MISA (ở "Yêu cầu theo nhân viên").
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {rows === null ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            Chưa có nhân viên nào khớp mã MISA — vào "Yêu cầu theo nhân viên" để gán mã trước.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3">Nhân viên</th>
                <th className="px-5 py-3">MISA · Tổng công (giờ)</th>
                <th className="px-5 py-3">MISA · OT (giờ)</th>
                <th className="px-5 py-3">iHNS · Số ngày công</th>
                <th className="px-5 py-3">iHNS · OT (giờ)</th>
                <th className="px-5 py-3">Chênh OT</th>
                <th className="px-5 py-3">Chênh đi muộn/về sớm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const otMismatch = r.otDiff !== null && Math.abs(r.otDiff) > 0.5
                const lateMismatch = r.lateEarlyDiff !== null && r.lateEarlyDiff !== 0
                return (
                  <tr key={r.user_id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {r.full_name}
                      <span className="ml-1.5 text-xs text-gray-400">({r.misa_employee_code})</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{r.misa ? r.misa.totalWorking.toFixed(2) : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{r.misa ? r.misa.totalOverTime.toFixed(2) : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{r.ihns ? r.ihns.tongCongDays : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{r.ihns ? r.ihns.otHours.toFixed(2) : '—'}</td>
                    <td className={`px-5 py-3 font-semibold ${otMismatch ? 'text-red-500' : 'text-gray-400'}`}>
                      {r.otDiff !== null ? (r.otDiff > 0 ? `+${r.otDiff}` : r.otDiff) : '—'}
                    </td>
                    <td className={`px-5 py-3 font-semibold ${lateMismatch ? 'text-amber-500' : 'text-gray-400'}`}>
                      {r.lateEarlyDiff !== null ? (r.lateEarlyDiff > 0 ? `+${r.lateEarlyDiff}` : r.lateEarlyDiff) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
