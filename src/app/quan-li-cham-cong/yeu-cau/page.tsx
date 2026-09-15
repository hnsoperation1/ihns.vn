'use client'

import { useEffect, useState } from 'react'
import { Loader2, ScanFace, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'
import type { MisaEmployee } from '@/lib/misa'

type Employee = {
  id: string
  full_name: string
  email: string
  require_gps: boolean
  require_wifi: boolean
  require_face: boolean
  location_id: string | null
  shift_id: string | null
  misa_employee_code: string | null
}

type Location = { id: string; name: string }
type Shift = { id: string; name: string; is_default: boolean }

type FaceEnrollment =
  | { id: string; enrolled: false }
  | { id: string; enrolled: true; enrolledAt: string; embeddings: number[][]; imageUrls: string[] }

export default function YeuCauChamCongPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [faceData, setFaceData] = useState<Map<string, FaceEnrollment>>(new Map())
  const [faceModalId, setFaceModalId] = useState<string | null>(null)
  const [misaCodeInputs, setMisaCodeInputs] = useState<Record<string, string>>({})
  const [misaEmployees, setMisaEmployees] = useState<MisaEmployee[] | null>(null)
  const [misaManualIds, setMisaManualIds] = useState<Set<string>>(new Set())
  const [threshold, setThreshold] = useState<number | null>(null)
  const [thresholdInput, setThresholdInput] = useState('')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [thresholdMsg, setThresholdMsg] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/employee-requirements')
    if (res.ok) {
      const data = await res.json()
      setEmployees(data.employees)
      setLocations(data.locations)
      setShifts(data.shifts)
      setMisaCodeInputs(Object.fromEntries(data.employees.map((e: Employee) => [e.id, e.misa_employee_code ?? ''])))
    }
    setLoading(false)
  }

  async function loadFaceData() {
    const res = await fetch('/api/admin/face-enrollments')
    if (res.ok) {
      const data = await res.json()
      setFaceData(new Map((data.employees as FaceEnrollment[]).map((e) => [e.id, e])))
    }
  }

  async function loadSettings() {
    const res = await fetch('/api/admin/settings')
    if (res.ok) {
      const data = await res.json()
      setThreshold(data.faceMatchThreshold)
      setThresholdInput(String(data.faceMatchThreshold))
    }
  }

  async function loadMisaEmployees() {
    try {
      const res = await fetch('/api/admin/misa-employees')
      const data = res.ok ? await res.json() : null
      setMisaEmployees(data?.employees ?? [])
    } catch {
      setMisaEmployees([])
    }
  }

  useEffect(() => {
    load()
    loadFaceData()
    loadSettings()
    loadMisaEmployees()
  }, [])

  async function saveThreshold() {
    const value = parseFloat(thresholdInput)
    if (Number.isNaN(value) || value <= 0 || value > 1) {
      setThresholdMsg('Giá trị phải trong khoảng (0, 1]')
      return
    }
    setSavingThreshold(true)
    setThresholdMsg('')
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceMatchThreshold: value }),
    })
    setSavingThreshold(false)
    if (res.ok) {
      setThreshold(value)
      setThresholdMsg('Đã lưu')
      setTimeout(() => setThresholdMsg(''), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      setThresholdMsg(data.error ?? 'Lưu thất bại')
    }
  }

  async function saveField(emp: Employee, patch: Partial<Employee>) {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, ...patch } : e)))
    setSavingId(emp.id)
    const res = await fetch('/api/admin/employee-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: emp.id, ...patch }),
    })
    setSavingId(null)
    if (!res.ok) load()
  }

  async function saveMisaCodeValue(emp: Employee, rawValue: string) {
    setMisaCodeInputs((prev) => ({ ...prev, [emp.id]: rawValue }))
    const code = rawValue.trim() === '' ? null : rawValue.trim()
    if (code === emp.misa_employee_code) return
    await saveField(emp, { misa_employee_code: code })
  }

  async function saveMisaCode(emp: Employee) {
    await saveMisaCodeValue(emp, misaCodeInputs[emp.id] ?? '')
  }

  const faceModalEmployee = faceModalId ? employees.find((e) => e.id === faceModalId) : null
  const faceModalData = faceModalId ? faceData.get(faceModalId) : null

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Yêu cầu chấm công theo nhân viên</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bỏ tick 1 điều kiện = nhân viên đó không cần đạt điều kiện đó mới được tính chấm công thành công. Gán địa
        điểm = luôn tính theo đúng địa điểm đó, không tự động lấy địa điểm gần nhất nữa.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
            <ScanFace size={14} className="text-brand-500" />
            Ngưỡng khớp khuôn mặt (áp dụng chung cho tất cả nhân viên)
          </h2>
          <p className="text-xs text-gray-400">Giá trị càng thấp càng chặt (khó giả mạo hơn nhưng dễ từ chối nhầm chính chủ). Mặc định 0.3.</p>
        </div>
        {threshold === null ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="button"
              onClick={saveThreshold}
              disabled={savingThreshold || thresholdInput === String(threshold)}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              {savingThreshold && <Loader2 size={14} className="animate-spin" />}
              Lưu
            </button>
            {thresholdMsg && <span className="text-xs text-gray-500">{thresholdMsg}</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Nhân viên</th>
                  <th className="px-4 py-3 text-center">GPS</th>
                  <th className="px-4 py-3 text-center">Wifi</th>
                  <th className="px-4 py-3 text-center">Face</th>
                  <th className="px-4 py-3">Địa điểm</th>
                  <th className="px-4 py-3">Ca</th>
                  <th className="px-4 py-3">Mã MISA</th>
                  <th className="px-4 py-3">Khuôn mặt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((emp) => {
                  const face = faceData.get(emp.id)
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/70 align-top">
                      <td className="px-5 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">{emp.full_name}</p>
                          {savingId === emp.id && <Loader2 size={12} className="animate-spin text-gray-400" />}
                        </div>
                        <p className="text-xs text-gray-400">{emp.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={emp.require_gps} onChange={(e) => saveField(emp, { require_gps: e.target.checked })} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={emp.require_wifi} onChange={(e) => saveField(emp, { require_wifi: e.target.checked })} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={emp.require_face} onChange={(e) => saveField(emp, { require_face: e.target.checked })} />
                      </td>
                      <td className="px-4 py-3 min-w-[170px]">
                        <select
                          value={emp.location_id ?? ''}
                          onChange={(e) => saveField(emp, { location_id: e.target.value || null })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          <option value="">Tự động (gần nhất)</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 min-w-[150px]">
                        <select
                          value={emp.shift_id ?? ''}
                          onChange={(e) => saveField(emp, { shift_id: e.target.value || null })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          <option value="">Mặc định{shifts.find((s) => s.is_default) ? ` (${shifts.find((s) => s.is_default)!.name})` : ''}</option>
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 min-w-[190px]">
                        {misaEmployees === null ? (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        ) : misaEmployees.length > 0 && !misaManualIds.has(emp.id) ? (
                          <div className="space-y-1">
                            <select
                              value={misaCodeInputs[emp.id] ?? ''}
                              onChange={(e) => saveMisaCodeValue(emp, e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              <option value="">— Chưa chọn —</option>
                              {misaEmployees.map((m) => (
                                <option key={m.EmployeeCode} value={m.EmployeeCode}>
                                  {m.FullName} ({m.EmployeeCode})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setMisaManualIds((s) => new Set(s).add(emp.id))}
                              className="text-[11px] text-gray-400 hover:underline"
                            >
                              Nhập tay
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={misaCodeInputs[emp.id] ?? ''}
                              onChange={(e) => setMisaCodeInputs((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                              onBlur={() => saveMisaCode(emp)}
                              placeholder="Mã MISA"
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                            />
                            {misaEmployees.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMisaManualIds((s) => {
                                    const next = new Set(s)
                                    next.delete(emp.id)
                                    return next
                                  })
                                }
                                className="text-[11px] text-gray-400 hover:underline"
                              >
                                Chọn từ danh sách
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {face?.enrolled ? (
                          <button type="button" onClick={() => setFaceModalId(emp.id)} className="text-xs font-medium text-green-600 hover:underline">
                            Đã thiết lập ({face.embeddings.length})
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">Chưa thiết lập</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {faceModalEmployee && faceModalData?.enrolled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setFaceModalId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">{faceModalEmployee.full_name}</p>
                <p className="text-xs text-gray-400">Thiết lập lúc {new Date(faceModalData.enrolledAt).toLocaleString('vi-VN')}</p>
              </div>
              <button onClick={() => setFaceModalId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {faceModalData.imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh signed URL riêng tư, không dùng next/image tối ưu qua CDN công khai
                  <img key={i} src={url} alt={`Mẫu ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                ))}
              </div>
              <details>
                <summary className="text-xs text-brand-600 hover:underline cursor-pointer">Xem vector</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-50 p-2 text-[10px] leading-tight text-gray-500">
                  {JSON.stringify(
                    faceModalData.embeddings.map((v) => v.map((n) => Number(n.toFixed(3)))),
                    null,
                    1,
                  )}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
