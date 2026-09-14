'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Trash2, LocateFixed, Pencil, X, Check, Wifi, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { PageHeader } from '@/components/PageHeader'

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

export default function DiaDiemPage() {
  const { user, loading: authLoading } = useAuth()
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('150')
  const [officeIp, setOfficeIp] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', address: '', lat: '', lng: '', radius: '', officeIp: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [fetchingIp, setFetchingIp] = useState(false)

  // Nối thêm IP hiện tại vào ô đang có (cách nhau bởi dấu phẩy, tránh thêm
  // trùng) — cùng cơ chế "cách nhau bởi dấu phẩy" mà backend đã hỗ trợ sẵn.
  function appendIp(current: string, ip: string): string {
    const parts = current.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.includes(ip)) return current
    return [...parts, ip].join(', ')
  }

  async function fetchMyIp(): Promise<string | null> {
    setFetchingIp(true)
    try {
      const res = await fetch('/api/admin/my-ip')
      const data = await res.json()
      return res.ok ? (data.ip as string) : null
    } catch {
      return null
    } finally {
      setFetchingIp(false)
    }
  }

  async function useMyIp() {
    const ip = await fetchMyIp()
    if (!ip) {
      setError('Không lấy được IP hiện tại')
      return
    }
    setOfficeIp((cur) => appendIp(cur, ip))
  }

  async function useMyIpForEdit() {
    const ip = await fetchMyIp()
    if (!ip) {
      setEditError('Không lấy được IP hiện tại')
      return
    }
    setEditForm((f) => ({ ...f, officeIp: appendIp(f.officeIp, ip) }))
  }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/work-locations')
    if (res.ok) {
      const data = await res.json()
      setLocations(data.locations)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function useCurrentPosition() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
      },
      () => setError('Không lấy được vị trí hiện tại'),
    )
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    const radiusNum = parseInt(radius, 10)
    if (!name.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError('Thiếu tên hoặc toạ độ hợp lệ')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/work-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, lat: latNum, lng: lngNum, radius_m: radiusNum, office_ip: officeIp }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Không tạo được địa điểm')
      return
    }
    setName('')
    setAddress('')
    setLat('')
    setLng('')
    setRadius('150')
    setOfficeIp('')
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

  function startEdit(loc: WorkLocation) {
    setEditingId(loc.id)
    setEditError('')
    setEditForm({
      name: loc.name,
      address: loc.address ?? '',
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius: String(loc.radius_m),
      officeIp: loc.office_ip ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  function useCurrentPositionForEdit() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }))
      },
      () => setEditError('Không lấy được vị trí hiện tại'),
    )
  }

  async function saveEdit(id: string) {
    setEditError('')
    const latNum = parseFloat(editForm.lat)
    const lngNum = parseFloat(editForm.lng)
    const radiusNum = parseInt(editForm.radius, 10)
    if (!editForm.name.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setEditError('Thiếu tên hoặc toạ độ hợp lệ')
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/admin/work-locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        address: editForm.address,
        lat: latNum,
        lng: lngNum,
        radius_m: Number.isNaN(radiusNum) ? undefined : radiusNum,
        office_ip: editForm.officeIp,
      }),
    })
    const data = await res.json()
    setEditSaving(false)
    if (!res.ok) {
      setEditError(data.error ?? 'Không lưu được thay đổi')
      return
    }
    setEditingId(null)
    load()
  }

  if (authLoading) return null
  if (!user?.is_super_admin && !user?.is_boss) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div>
      <PageHeader title="Địa điểm chấm công" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên địa điểm (vd: Văn phòng HN)"
            className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Địa chỉ (tuỳ chọn)"
            className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Vĩ độ (lat)"
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Kinh độ (lng)"
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
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
            value={officeIp}
            onChange={(e) => setOfficeIp(e.target.value)}
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
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-xl"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Thêm địa điểm
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : locations.length === 0 ? (
          <div className="p-5 text-sm text-gray-400">Chưa có địa điểm nào.</div>
        ) : (
          locations.map((loc) =>
            editingId === loc.id ? (
              <div key={loc.id} className="p-4 space-y-3 bg-brand-50/30">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Tên địa điểm"
                    className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Địa chỉ (tuỳ chọn)"
                    className="col-span-2 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    value={editForm.lat}
                    onChange={(e) => setEditForm((f) => ({ ...f, lat: e.target.value }))}
                    placeholder="Vĩ độ (lat)"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    value={editForm.lng}
                    onChange={(e) => setEditForm((f) => ({ ...f, lng: e.target.value }))}
                    placeholder="Kinh độ (lng)"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    value={editForm.radius}
                    onChange={(e) => setEditForm((f) => ({ ...f, radius: e.target.value }))}
                    placeholder="Bán kính cho phép (m)"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    type="button"
                    onClick={useCurrentPositionForEdit}
                    className="flex items-center justify-center gap-1.5 text-sm text-brand-600 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-50"
                  >
                    <LocateFixed size={14} />
                    Dùng vị trí hiện tại
                  </button>
                  <input
                    value={editForm.officeIp}
                    onChange={(e) => setEditForm((f) => ({ ...f, officeIp: e.target.value }))}
                    placeholder="IP văn phòng (tuỳ chọn, cách nhau bởi dấu phẩy)"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    type="button"
                    onClick={useMyIpForEdit}
                    disabled={fetchingIp}
                    className="flex items-center justify-center gap-1.5 text-sm text-brand-600 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-50 disabled:opacity-60"
                  >
                    {fetchingIp ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                    Lấy IP hiện tại
                  </button>
                </div>
                {editError && <p className="text-xs text-red-500">{editError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveEdit(loc.id)}
                    disabled={editSaving}
                    className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-bold px-3 py-1.5 rounded-xl"
                  >
                    {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Lưu
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50"
                  >
                    <X size={14} />
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <div key={loc.id} className="flex items-center justify-between p-4 gap-4">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin size={16} className="text-brand-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{loc.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {loc.address ? `${loc.address} — ` : ''}
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · bán kính {loc.radius_m}m
                    </p>
                    {loc.office_ip && (
                      <p className="flex items-center gap-1 text-xs text-brand-500 mt-0.5">
                        <Wifi size={11} />
                        {loc.office_ip}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(loc)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      loc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {loc.is_active ? 'Đang bật' : 'Đã tắt'}
                  </button>
                  <button onClick={() => startEdit(loc)} className="text-gray-400 hover:text-brand-500">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(loc)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </div>
      </div>
    </div>
  )
}
