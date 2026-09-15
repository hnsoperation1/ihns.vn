'use client'

import { useEffect, useState } from 'react'
import { Loader2, LogIn, LogOut, Wifi, Send, Globe, ScanFace, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type AttendanceRow = {
  id: string
  type: 'check_in' | 'check_out'
  created_at: string
  distance_m: number | null
  is_within_radius: boolean
  is_ip_verified: boolean
  is_face_verified: boolean
  face_distance: number | null
  is_success: boolean
  channel: 'web' | 'telegram' | 'telegram_webapp' | 'misa'
  hrm_work_locations: { name: string } | null
  users: { full_name: string; email: string } | null
}

export default function BaoCaoPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/attendance')
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => setRows(data.logs ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Báo cáo chấm công</h1>
      <p className="text-sm text-gray-400 mb-6">{rows.length} lượt gần nhất, tối đa 500 dòng.</p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Chưa có dữ liệu chấm công.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Địa điểm</th>
                  <th className="px-4 py-3">GPS</th>
                  <th className="px-4 py-3">Mạng</th>
                  <th className="px-4 py-3">Khuôn mặt</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{row.users?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{row.users?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium text-gray-700">
                        {row.type === 'check_in' ? <LogIn size={13} className="text-brand-500" /> : <LogOut size={13} className="text-accent-500" />}
                        {row.type === 'check_in' ? 'Vào' : 'Ra'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-gray-600">{row.hrm_work_locations?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${row.is_within_radius ? 'text-green-600' : 'text-red-500'}`}>
                        <MapPin size={13} />
                        {row.distance_m != null ? `${Math.round(row.distance_m)}m` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${row.is_ip_verified ? 'text-green-600' : 'text-red-500'}`}>
                        <Wifi size={13} />
                        {row.is_ip_verified ? 'Đúng' : 'Sai'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${row.is_face_verified ? 'text-green-600' : 'text-red-500'}`}>
                        <ScanFace size={13} />
                        {row.face_distance != null ? row.face_distance.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-gray-400">
                        {row.channel === 'telegram' || row.channel === 'telegram_webapp' ? <Send size={13} /> : <Globe size={13} />}
                        {row.channel === 'telegram' || row.channel === 'telegram_webapp' ? 'Telegram' : row.channel === 'misa' ? 'MISA' : 'Web'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.is_success ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">Thành công</span>
                      ) : (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">Thất bại</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
