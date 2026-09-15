'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type Employee = { id: string; full_name: string; email: string }

type DayStatus = 'du_cong' | 'thieu_cong' | 'nghi' | 'none'

type TimesheetDay = {
  date: string
  status: DayStatus
  checkIn: string | null
  checkOut: string | null
  isLate: boolean
  isEarly: boolean
  otHours: number
}

type Timesheet = {
  shift: { name: string; start_time: string; end_time: string } | null
  noShiftConfigured: boolean
  isMisaAuthoritative: boolean
  days: TimesheetDay[]
  stats: { tongCongDays: number; otHours: number; lateEarlyCount: number; nghiDays: number }
}

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function monthLabel(year: number, month: number) {
  const first = `01/${String(month).padStart(2, '0')}/${year}`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${lastDay}/${String(month).padStart(2, '0')}/${year}`
  return `${first} - ${last}`
}

function formatDayHeading(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

function mondayFirstIndex(dateKey: string) {
  const jsDay = new Date(`${dateKey}T00:00:00`).getDay()
  return (jsDay + 6) % 7
}

function StatusBadge({ status }: { status: DayStatus }) {
  if (status === 'du_cong') return <Plus size={14} className="text-white" />
  if (status === 'thieu_cong') return <Minus size={14} className="text-white" />
  if (status === 'nghi') return <span className="block h-1.5 w-3 rounded bg-white" />
  return null
}

function statusBg(status: DayStatus) {
  if (status === 'du_cong') return 'bg-green-500'
  if (status === 'thieu_cong') return 'bg-amber-500'
  if (status === 'nghi') return 'bg-gray-300'
  return 'bg-gray-100'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// Master-detail: danh sách nhân viên bên trái, Bảng công của người đang chọn
// bên phải — giống hệt cấu trúc trang này bên CRM (đã redesign PC-first).
export default function NhanVienChamCongPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const today = new Date(Date.now() + 7 * 3600 * 1000)
  const [year, setYear] = useState(today.getUTCFullYear())
  const [month, setMonth] = useState(today.getUTCMonth() + 1)
  const [data, setData] = useState<Timesheet | null>(null)
  const [tab, setTab] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/employees')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEmployees(data?.employees ?? []))
  }, [isAdmin])

  useEffect(() => {
    if (!selectedId) return
    setData(null)
    fetch(`/api/admin/timesheet?userId=${selectedId}&month=${year}-${String(month).padStart(2, '0')}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
  }, [selectedId, year, month])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setMonth(m)
    setYear(y)
  }

  const filtered = (employees ?? []).filter((e) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
  })

  const selected = employees?.find((e) => e.id === selectedId) ?? null
  const leadingBlanks = data ? mondayFirstIndex(data.days[0].date) : 0
  const daysWithData = useMemo(() => (data ? data.days.filter((d) => d.status !== 'none' || d.checkIn || d.checkOut) : []), [data])

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/80">
      <div className="flex-shrink-0 px-6 py-5">
        <BackLink />
        <h1 className="text-2xl font-bold text-gray-900">Dữ liệu chấm công theo nhân viên</h1>
        <p className="text-sm text-gray-400 mt-0.5">Chọn 1 nhân viên để xem Bảng công của họ.</p>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full grid grid-cols-[320px_1fr] gap-5">
          {/* Left: employee list */}
          <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên hoặc email..."
                  className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {employees === null ? (
                <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Đang tải...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-5 text-sm text-gray-400">Không tìm thấy nhân viên nào.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedId(emp.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${selectedId === emp.id ? 'bg-brand-50' : ''}`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selectedId === emp.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {getInitials(emp.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${selectedId === emp.id ? 'font-semibold text-brand-700' : 'font-medium text-gray-800'}`}>
                          {emp.full_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{emp.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: timesheet detail */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-y-auto">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <UserRound size={40} className="mb-3" />
                <p className="text-sm">Chọn một nhân viên để xem Bảng công</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-bold text-gray-900">{selected.full_name}</h2>
                    <p className="text-xs text-gray-400">{selected.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => shiftMonth(-1)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium text-gray-700 w-40 text-center">{monthLabel(year, month)}</span>
                    <button type="button" onClick={() => shiftMonth(1)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {!data ? (
                  <div className="flex justify-center py-16 text-gray-400">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-[minmax(0,320px)_1fr] gap-6">
                    <div>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="rounded-xl border border-gray-100 p-3 text-center">
                          <p className="text-lg font-bold text-green-600">{data.stats.tongCongDays}</p>
                          <p className="text-[11px] text-gray-400">Tổng công (ngày)</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-3 text-center">
                          <p className="text-lg font-bold text-brand-600">{data.stats.otHours}</p>
                          <p className="text-[11px] text-gray-400">Làm thêm (giờ)</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-3 text-center">
                          <p className="text-lg font-bold text-amber-500">{data.stats.lateEarlyCount}</p>
                          <p className="text-[11px] text-gray-400">Đi muộn, về sớm (lần)</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-3 text-center">
                          <p className="text-lg font-bold text-red-500">{data.stats.nghiDays}</p>
                          <p className="text-[11px] text-gray-400">Nghỉ (ngày)</p>
                        </div>
                      </div>

                      {data.noShiftConfigured && (
                        <p className="mb-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-700">
                          Chưa cấu hình ca làm việc nào — số liệu đủ/thiếu công chỉ mang tính tham khảo.
                        </p>
                      )}
                      {data.isMisaAuthoritative && (
                        <p className="mb-3 rounded-xl bg-gray-50 p-2.5 text-xs text-gray-500">
                          Bảng công này lấy theo dữ liệu chấm công từ MISA — chấm công qua web/app chỉ để thử nghiệm.
                        </p>
                      )}
                      {data.shift && (
                        <p className="mb-3 text-xs text-gray-400">
                          Ca áp dụng: {data.shift.name} ({data.shift.start_time.slice(0, 5)} – {data.shift.end_time.slice(0, 5)})
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="flex h-4 w-4 items-center justify-center rounded bg-green-500 text-white"><Plus size={10} /></span> Đủ công
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-500 text-white"><Minus size={10} /></span> Thiếu công
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-4 w-4 rounded bg-gray-300" /> Nghỉ
                        </span>
                        <span className="flex items-center gap-1 font-bold text-brand-600">OT Làm thêm giờ</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-4 flex w-64 rounded-xl bg-gray-100 p-1">
                        <button
                          type="button"
                          onClick={() => setTab('grid')}
                          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${tab === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                          Dạng lịch
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab('list')}
                          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${tab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                          Danh sách
                        </button>
                      </div>

                      {tab === 'grid' ? (
                        <div className="max-w-md">
                          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
                            {WEEKDAY_HEADERS.map((w) => (
                              <span key={w} className={w === 'CN' ? 'text-red-400' : ''}>
                                {w}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1.5">
                            {Array.from({ length: leadingBlanks }).map((_, i) => (
                              <div key={`blank-${i}`} />
                            ))}
                            {data.days.map((d) => {
                              const dayNum = Number(d.date.slice(8, 10))
                              const isSunday = new Date(`${d.date}T00:00:00`).getDay() === 0
                              return (
                                <div key={d.date} className="flex flex-col items-center gap-1">
                                  <span className={`text-xs ${isSunday ? 'text-red-400' : 'text-gray-600'}`}>{dayNum}</span>
                                  {d.status !== 'none' ? (
                                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${statusBg(d.status)}`}>
                                      <StatusBadge status={d.status} />
                                    </span>
                                  ) : (
                                    <span className="h-6 w-6" />
                                  )}
                                  {d.otHours > 0 && <span className="text-[9px] font-bold text-brand-600">OT</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : daysWithData.length === 0 ? (
                        <p className="py-10 text-center text-sm text-gray-400">Chưa có dữ liệu.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {daysWithData.map((d) => (
                            <div key={d.date} className="rounded-xl border border-gray-100 p-3">
                              <p className="mb-1.5 text-xs font-medium text-gray-400">{formatDayHeading(d.date)}</p>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${statusBg(d.status)}`}>
                                    <StatusBadge status={d.status} />
                                  </span>
                                  {d.status === 'nghi' ? 'Nghỉ phép' : 'Ca hành chính'}
                                </span>
                                {(d.checkIn || d.checkOut) && (
                                  <span className="text-sm text-gray-500">
                                    {d.checkIn ?? '--'} - {d.checkOut ?? '--'}
                                  </span>
                                )}
                              </div>
                              {d.otHours > 0 && <p className="mt-1.5 text-xs font-bold text-brand-600">OT {d.otHours} giờ</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
