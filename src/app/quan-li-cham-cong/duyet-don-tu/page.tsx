'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Send, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { BackLink } from '../_components/BackLink'

type Employee = {
  id: string
  full_name: string
  email: string
  telegram_chat_id: number | null
}

type Group = { chat_id: number; label: string }

export default function DuyetDonTuPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  const [employees, setEmployees] = useState<Employee[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [attendanceAdminUserId, setAttendanceAdminUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [chatIdInputs, setChatIdInputs] = useState<Record<string, string>>({})

  const [newGroupChatId, setNewGroupChatId] = useState('')
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [groupError, setGroupError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/leave-approval-config')
    if (res.ok) {
      const data = await res.json()
      setEmployees(data.employees)
      setGroups(data.groups)
      setAttendanceAdminUserId(data.attendanceAdminUserId)
      setChatIdInputs(Object.fromEntries(data.employees.map((e: Employee) => [e.id, e.telegram_chat_id?.toString() ?? ''])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/leave-approval-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  }

  async function saveChatId(emp: Employee) {
    const raw = chatIdInputs[emp.id]?.trim() ?? ''
    const chatId = raw === '' ? null : Number(raw)
    if (chatId !== null && Number.isNaN(chatId)) return
    if (chatId === emp.telegram_chat_id) return
    setSavingId(emp.id)
    const ok = await post({ kind: 'link', userId: emp.id, chatId })
    setSavingId(null)
    if (ok) {
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, telegram_chat_id: chatId } : e)))
    } else {
      load()
    }
  }

  async function saveAdmin(userId: string | null) {
    setAttendanceAdminUserId(userId)
    await post({ kind: 'admin', userId })
  }

  async function addGroup() {
    setGroupError('')
    const chatId = Number(newGroupChatId.trim())
    if (Number.isNaN(chatId) || !newGroupLabel.trim()) {
      setGroupError('Nhập đủ ID nhóm (số) và tên nhóm')
      return
    }
    const ok = await post({ kind: 'group_add', chatId, label: newGroupLabel.trim() })
    if (ok) {
      setNewGroupChatId('')
      setNewGroupLabel('')
      load()
    } else {
      setGroupError('Không thêm được — chat_id có thể đã tồn tại')
    }
  }

  async function removeGroup(chatId: number) {
    await post({ kind: 'group_remove', chatId })
    setGroups((prev) => prev.filter((g) => g.chat_id !== chatId))
  }

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Duyệt đơn từ</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bot Telegram đọc tin nhắn xin nghỉ/đi muộn/về sớm/làm online/công tác trong các nhóm HCNS bên dưới, cần cấu
        hình ID Telegram của từng người thì bot mới biết ai với ai.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
            <Send size={14} className="text-brand-500" />
            Admin chấm công (người bấm &quot;Duyệt&quot;)
          </h2>
          <p className="text-xs text-gray-400 mb-3">Áp dụng chung cho toàn bộ đơn từ, không phân theo nhân viên.</p>
          <select
            value={attendanceAdminUserId ?? ''}
            onChange={(e) => saveAdmin(e.target.value || null)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Chưa chọn</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
            <Users size={14} className="text-brand-500" />
            Nhóm HCNS
          </h2>
          <p className="text-xs text-gray-400 mb-3">Thêm bot vào nhóm, nhắn 1 câu bất kỳ — bot trả lời kèm ID nhóm (số âm), dán vào đây.</p>

          {loading ? (
            <Loader2 size={14} className="animate-spin text-gray-400" />
          ) : (
            <div className="space-y-2 mb-3">
              {groups.length === 0 && <p className="text-xs text-gray-400">Chưa có nhóm nào được cấu hình.</p>}
              {groups.map((g) => (
                <div key={g.chat_id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{g.label}</p>
                    <p className="text-xs text-gray-400">{g.chat_id}</p>
                  </div>
                  <button type="button" onClick={() => removeGroup(g.chat_id)} className="shrink-0 text-gray-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              value={newGroupChatId}
              onChange={(e) => setNewGroupChatId(e.target.value)}
              placeholder="ID nhóm (vd -1001234567890)"
              className="flex-1 min-w-[140px] text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              placeholder="Tên nhóm"
              className="flex-1 min-w-[120px] text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="button"
              onClick={addGroup}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              <Plus size={14} /> Thêm
            </button>
          </div>
          {groupError && <p className="text-xs text-red-500 mt-2">{groupError}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Nhân viên</h2>
          <p className="text-xs text-gray-400">ID Telegram: nhân viên tự nhắn cho bot để lấy ID, gửi cho bạn dán vào đây.</p>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-5 py-2.5">Nhân viên</th>
                <th className="px-5 py-2.5">ID Telegram</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/70">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{emp.full_name}</p>
                      {savingId === emp.id && <Loader2 size={12} className="animate-spin text-gray-400" />}
                    </div>
                    <p className="text-xs text-gray-400">{emp.email}</p>
                  </td>
                  <td className="px-5 py-2.5 w-56">
                    <input
                      value={chatIdInputs[emp.id] ?? ''}
                      onChange={(e) => setChatIdInputs((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                      onBlur={() => saveChatId(emp)}
                      placeholder="ID Telegram"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
