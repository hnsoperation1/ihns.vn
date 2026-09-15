'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'
import { LEAVE_REQUEST_FIELDS, LEAVE_REQUEST_TITLES, type LeaveRequestType } from '@/lib/leaveRequestParser'
import { LEAVE_REQUEST_STATUS_COLORS, LEAVE_REQUEST_STATUS_LABELS } from '@/lib/leaveRequestDisplay'

type LeaveRequest = {
  requestNo: number
  type: LeaveRequestType
  fields: Record<string, string>
  status: string
  requesterName: string
  rawText: string
  createdAt: string
}

export default function DonTuAdminPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [requests, setRequests] = useState<LeaveRequest[] | null>(null)
  const [detail, setDetail] = useState<LeaveRequest | null>(null)

  useEffect(() => {
    fetch('/api/admin/leave-requests')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRequests(data?.requests ?? []))
  }, [])

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Đơn từ (quản trị)</h1>
      <p className="mb-6 text-sm text-gray-400">
        Xem lại toàn bộ đơn từ trong hệ thống — nộp/sửa/hủy/duyệt vẫn thao tác trực tiếp qua Telegram, trang này chỉ
        để đối chiếu.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {requests === null ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Chưa có đơn từ nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3">Loại đơn</th>
                <th className="px-5 py-3">Người nộp</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Ngày tạo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((r) => (
                <tr key={r.requestNo} className="hover:bg-gray-50/70">
                  <td className="px-5 py-3 font-medium text-gray-800">{LEAVE_REQUEST_TITLES[r.type]}</td>
                  <td className="px-5 py-3 text-gray-600">{r.requesterName}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${LEAVE_REQUEST_STATUS_COLORS[r.status]}`}>
                      {LEAVE_REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setDetail(r)} className="text-xs font-medium text-brand-600 hover:underline">
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">{LEAVE_REQUEST_TITLES[detail.type]}</p>
                <p className="text-xs text-gray-400">{detail.requesterName}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${LEAVE_REQUEST_STATUS_COLORS[detail.status]}`}>
                {LEAVE_REQUEST_STATUS_LABELS[detail.status]}
              </span>
              <div className="space-y-1 text-sm text-gray-600">
                {LEAVE_REQUEST_FIELDS[detail.type].map((f) => (
                  <p key={f.key}>
                    <span className="text-gray-400">{f.label}:</span> {detail.fields[f.key]?.trim() || '(chưa rõ)'}
                  </p>
                ))}
              </div>
              <p className="text-xs text-gray-400">{new Date(detail.createdAt).toLocaleString('vi-VN')}</p>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Tin nhắn gốc</p>
                <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-500">{detail.rawText}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
