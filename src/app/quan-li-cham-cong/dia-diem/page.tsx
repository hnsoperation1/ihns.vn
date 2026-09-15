'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Trash2, LocateFixed, Pencil, X, Wifi, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type WorkLocation = {
  id: string
  name: string
  address: string | null
  lat: number
  lng: number
  radius_m: number
  office_ip: string | null
  is_active: boolean
}

const EMPTY_FORM = { name: '', address: '', lat: '', lng: '', radius: '150', officeIp: '' }

export default function DiaDiemPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fetchingIp, setFetchingIp] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WorkLocation | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/work-locations')
    if (res.ok) setLocations((await res.json()).locations)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setShowForm(true)
  }

  function openEdit(loc: WorkLocation) {
    setEditing(loc)
    setForm({
      name: loc.name,
      address: loc.address ?? '',
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius: String(loc.radius_m),
      officeIp: loc.office_ip ?? '',
    })
    setError('')
    setShowForm(true)
  }

  function useCurrentPosition() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => setError('Không lấy được vị trí hiện tại'),
    )
  }

  // Nối thêm IP hiện tại vào ô đang có (cách nhau bởi dấu phẩy, tránh thêm
  // trùng) — cùng cơ chế "cách nhau bởi dấu phẩy" mà backend đã hỗ trợ sẵn.
  async function useMyIp() {
    setFetchingIp(true)
    try {
      const res = await fetch('/api/admin/my-ip')
      const data = await res.json()
      if (!res.ok) {
        setError('Không lấy được IP hiện tại')
        return
      }
      setForm((f) => {
        const parts = f.officeIp.split(',').map((p) => p.trim()).filter(Boolean)
        if (parts.includes(data.ip)) return f
        return { ...f, officeIp: [...parts, data.ip].join(', ') }
      })
    } finally {
      setFetchingIp(false)
    }
  }

  async function handleSubmit() {
    setError('')
    const latNum = parseFloat(form.lat)
    const lngNum = parseFloat(form.lng)
    const radiusNum = parseInt(form.radius, 10)
    if (!form.name.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError('Thiếu tên hoặc toạ độ hợp lệ')
      return
    }
    setSaving(true)
    const body = { name: form.name, address: form.address, lat: latNum, lng: lngNum, radius_m: radiusNum, office_ip: form.officeIp }
    const res = editing
      ? await fetch(`/api/admin/work-locations/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/admin/work-locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Không lưu được')
      return
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(loc: WorkLocation) {
    await fetch(`/api/admin/work-locations/${loc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !loc.is_active }),
    })
    load()
  }

  async function remove(loc: WorkLocation) {
    if (!confirm(`Xoá địa điểm "${loc.name}"?`)) return
    await fetch(`/api/admin/work-locations/${loc.id}`, { method: 'DELETE' })
    load()
  }

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BackLink />
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Địa điểm chấm công</h1>
          <p className="text-sm text-gray-400 mt-0.5">{locations.length} địa điểm</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-semibold hover:bg-accent-600 transition-colors shadow-sm"
        >
          <Plus size={16} /> Thêm địa điểm
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : locations.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">Chưa có địa điểm nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Tên địa điểm</th>
                  <th className="px-5 py-3">Toạ độ</th>
                  <th className="px-5 py-3">Bán kính</th>
                  <th className="px-5 py-3">IP văn phòng</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{loc.name}</p>
                      {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{loc.radius_m}m</td>
                    <td className="px-5 py-3.5">
                      {loc.office_ip ? (
                        <span className="flex items-center gap-1 text-brand-600">
                          <Wifi size={12} /> {loc.office_ip}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleActive(loc)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${loc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {loc.is_active ? 'Đang bật' : 'Đã tắt'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(loc)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-brand-500">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(loc)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">{editing ? 'Sửa địa điểm' : 'Thêm địa điểm mới'}</p>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Tên địa điểm (vd: Văn phòng HN)"
                  className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Địa chỉ (tuỳ chọn)"
                  className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="Vĩ độ (lat)"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="Kinh độ (lng)"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  value={form.radius}
                  onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
                  placeholder="Bán kính cho phép (m)"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={useCurrentPosition}
                  className="flex items-center justify-center gap-1.5 text-sm text-brand-600 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-50"
                >
                  <LocateFixed size={14} />
                  Dùng vị trí hiện tại
                </button>
                <input
                  value={form.officeIp}
                  onChange={(e) => setForm((f) => ({ ...f, officeIp: e.target.value }))}
                  placeholder="IP văn phòng (tuỳ chọn, cách nhau bởi dấu phẩy)"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={useMyIp}
                  disabled={fetchingIp}
                  className="flex items-center justify-center gap-1.5 text-sm text-brand-600 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-50 disabled:opacity-60"
                >
                  {fetchingIp ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                  Lấy IP hiện tại
                </button>
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
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo địa điểm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
